
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/About.svelte generated by Svelte v3.12.1 */

    const file = "src/About.svelte";

    function create_fragment(ctx) {
    	var section, img0, t0, div, a0, img1, t1, a1, img2, t2, a2, img3, t3, a3, img4;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img0 = element("img");
    			t0 = space();
    			div = element("div");
    			a0 = element("a");
    			img1 = element("img");
    			t1 = space();
    			a1 = element("a");
    			img2 = element("img");
    			t2 = space();
    			a2 = element("a");
    			img3 = element("img");
    			t3 = space();
    			a3 = element("a");
    			img4 = element("img");
    			attr_dev(img0, "id", "me");
    			attr_dev(img0, "src", src);
    			attr_dev(img0, "alt", "pic");
    			attr_dev(img0, "width", "100");
    			attr_dev(img0, "class", "svelte-2sbkk2");
    			add_location(img0, file, 31, 1, 500);
    			attr_dev(img1, "src", "face-icon.png");
    			attr_dev(img1, "alt", "person");
    			attr_dev(img1, "width", "30");
    			add_location(img1, file, 34, 3, 626);
    			attr_dev(a0, "class", "contact-link svelte-2sbkk2");
    			attr_dev(a0, "href", "https://blog.rongying.co");
    			add_location(a0, file, 33, 2, 566);
    			attr_dev(img2, "src", "github-icon.png");
    			attr_dev(img2, "alt", "github");
    			attr_dev(img2, "width", "40");
    			add_location(img2, file, 37, 3, 751);
    			attr_dev(a1, "class", "contact-link svelte-2sbkk2");
    			attr_dev(a1, "href", "https://github.com/kohrongying");
    			add_location(a1, file, 36, 2, 685);
    			attr_dev(img3, "src", "mail-icon.png");
    			attr_dev(img3, "alt", "mail");
    			attr_dev(img3, "width", "25");
    			add_location(img3, file, 40, 3, 890);
    			attr_dev(a2, "class", "contact-link svelte-2sbkk2");
    			attr_dev(a2, "href", "mailto:kohrongying@gmail.com?Subject=Hello");
    			add_location(a2, file, 39, 2, 812);
    			attr_dev(img4, "src", "lnkedin-icon.png");
    			attr_dev(img4, "alt", "linkedin");
    			attr_dev(img4, "width", "30");
    			add_location(img4, file, 43, 3, 1021);
    			attr_dev(a3, "class", "contact-link svelte-2sbkk2");
    			attr_dev(a3, "href", "https://sg.linkedin.com/in/rongyingkoh");
    			add_location(a3, file, 42, 2, 947);
    			attr_dev(div, "id", "contactme");
    			attr_dev(div, "class", "svelte-2sbkk2");
    			add_location(div, file, 32, 1, 543);
    			attr_dev(section, "id", "left-fixed");
    			attr_dev(section, "class", "svelte-2sbkk2");
    			add_location(section, file, 30, 0, 473);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img0);
    			append_dev(section, t0);
    			append_dev(section, div);
    			append_dev(div, a0);
    			append_dev(a0, img1);
    			append_dev(div, t1);
    			append_dev(div, a1);
    			append_dev(a1, img2);
    			append_dev(div, t2);
    			append_dev(div, a2);
    			append_dev(a2, img3);
    			append_dev(div, t3);
    			append_dev(div, a3);
    			append_dev(a3, img4);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(section);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    const src = "pic.png";

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "About", options, id: create_fragment.name });
    	}
    }

    const repos = [
      {
        name: "Expense Tracker",
        desc: "PWA that helps to keep track of your daily expenses",
        url: "https://imma-save-more-money.netlify.com/",
        github_url: "https://github.com/kohrongying/expenses-tracker"
      },
      {
        name: "Telegram News Bot",
        desc: "A Telegram bot that delivers news",
        url: "https://telegram.me/ry_news_chat_bot",
        github_url: "https://github.com/kohrongying/telegram-news-bot"
      },
      {
        name: "Pokeipsum",
        desc: "A Pokemon x Lorem Ipsum npm package",
        url: "https://www.npmjs.com/package/pokeipsum",
        github_url: "https://github.com/kohrongying/pokeipsum"
      },
      {
        name: "Hex 2 RGB",
        desc: "Convert rgba to hex (with transparency support)",
        url: "https://kohrongying.github.io/hex-to-rgba/",
        github_url: "https://github.com/kohrongying/hex-to-rgba"
      },
      {
        name: "Avatar Generator",
        desc: "A python CLI tool to generate avatar sprites",
        url: "https://github.com/kohrongying/avatar-generator",
        github_url: "https://github.com/kohrongying/avatar-generator"
      },
      {
        name: "Rails React Crash Course",
        desc: "A crash course into a full stack",
        url: "https://github.com/kohrongying/react-rails-crashcourse/tree/master/tutorial",
        github_url: "https://github.com/kohrongying/react-rails-crashcourse"
      },
      {
        name: "CSS Battle",
        desc: "My participation in cssbattle.dev",
        url: "https://github.com/kohrongying/css-battle",
        github_url: "https://github.com/kohrongying/css-battle"
      },
      {
        name: "CSS Images",
        desc: "Images made from pure CSS",
        url: "https://kohrongying.github.io/css-images",
        github_url: "https://github.com/kohrongying/css-images"
      },
      {
        name: "Danang",
        desc: "A picture journey of my trip to Danang, Vietnam",
        url: "https://kohrongying.github.io/danang/",
        github_url: "https://github.com/kohrongying/danang"
      },
      {
        name: "Spotlight",
        desc: "A CSS solution that creates new insight when you hover over the picture.",
        url: "https://kohrongying.github.io/spotlight/",
        github_url: "https://github.com/kohrongying/spotlight"
      },
      {
        name: "Hoppip",
        desc: "A framework-less solution to full page transitions",
        url: "https://kohrongying.github.io/hoppip/",
        github_url: "https://github.com/kohrongying/hoppip"
      },		
    ];

    /* src/Works.svelte generated by Svelte v3.12.1 */

    const file$1 = "src/Works.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.repo = list[i];
    	return child_ctx;
    }

    // (34:4) {#each repos as repo}
    function create_each_block(ctx) {
    	var div1, div0, a0, t0_value = ctx.repo.name + "", t0, t1, a1, svg, path, t2, span, t3_value = ctx.repo.desc + "", t3, t4;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			a1 = element("a");
    			svg = svg_element("svg");
    			path = svg_element("path");
    			t2 = space();
    			span = element("span");
    			t3 = text(t3_value);
    			t4 = space();
    			attr_dev(a0, "class", "site-link");
    			attr_dev(a0, "href", ctx.repo.url);
    			add_location(a0, file$1, 36, 10, 661);
    			attr_dev(path, "fill-rule", "evenodd");
    			attr_dev(path, "d", "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z");
    			add_location(path, file$1, 40, 166, 943);
    			attr_dev(svg, "class", "octicon octicon-mark-github v-align-middle");
    			attr_dev(svg, "height", "25");
    			attr_dev(svg, "viewBox", "0 0 16 16");
    			attr_dev(svg, "version", "1.1");
    			attr_dev(svg, "width", "25");
    			attr_dev(svg, "aria-hidden", "true");
    			attr_dev(svg, "fill", "currentColor");
    			add_location(svg, file$1, 40, 14, 791);
    			attr_dev(a1, "href", ctx.repo.github_url);
    			add_location(a1, file$1, 39, 12, 750);
    			attr_dev(div0, "class", "title-container svelte-yt64v7");
    			add_location(div0, file$1, 35, 8, 621);
    			attr_dev(span, "class", "svelte-yt64v7");
    			add_location(span, file$1, 43, 8, 1596);
    			attr_dev(div1, "class", "card svelte-yt64v7");
    			add_location(div1, file$1, 34, 6, 594);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, a0);
    			append_dev(a0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, a1);
    			append_dev(a1, svg);
    			append_dev(svg, path);
    			append_dev(div1, t2);
    			append_dev(div1, span);
    			append_dev(span, t3);
    			append_dev(div1, t4);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block.name, type: "each", source: "(34:4) {#each repos as repo}", ctx });
    	return block;
    }

    function create_fragment$1(ctx) {
    	var section, div;

    	let each_value = repos;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    			attr_dev(div, "id", "card-container");
    			attr_dev(div, "class", "svelte-yt64v7");
    			add_location(div, file$1, 32, 2, 536);
    			attr_dev(section, "id", "right-fixed");
    			add_location(section, file$1, 31, 0, 507);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},

    		p: function update(changed, ctx) {
    			if (changed.repos) {
    				each_value = repos;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(section);
    			}

    			destroy_each(each_blocks, detaching);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    class Works extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$1, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Works", options, id: create_fragment$1.name });
    	}
    }

    /* src/App.svelte generated by Svelte v3.12.1 */

    const file$2 = "src/App.svelte";

    function create_fragment$2(ctx) {
    	var div, t, current;

    	var about = new About({ $$inline: true });

    	var works = new Works({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			about.$$.fragment.c();
    			t = space();
    			works.$$.fragment.c();
    			attr_dev(div, "id", "app-container");
    			attr_dev(div, "class", "svelte-f0do26");
    			add_location(div, file$2, 20, 0, 341);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(about, div, null);
    			append_dev(div, t);
    			mount_component(works, div, null);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			transition_in(about.$$.fragment, local);

    			transition_in(works.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(about.$$.fragment, local);
    			transition_out(works.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			destroy_component(about);

    			destroy_component(works);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$2.name, type: "component", source: "", ctx });
    	return block;
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$2, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "App", options, id: create_fragment$2.name });
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map