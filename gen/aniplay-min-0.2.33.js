
/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.8 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.8',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && navigator && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value !== 'string') {
                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite and existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; ary[i]; i += 1) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgName, pkgConfig, mapValue, nameParts, i, j, nameSegment,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    if (getOwn(config.pkgs, baseName)) {
                        //If the baseName is a package name, then just treat it as one
                        //name to concat the name with.
                        normalizedBaseParts = baseParts = [baseName];
                    } else {
                        //Convert baseName to array, and lop off the last part,
                        //so that . matches that 'directory' and not name of the baseName's
                        //module. For instance, baseName of 'one/two/three', maps to
                        //'one/two/three.js', but we want the directory, 'one/two' for
                        //this normalization.
                        normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    }

                    name = normalizedBaseParts.concat(name.split('/'));
                    trimDots(name);

                    //Some use of packages may use a . path to reference the
                    //'main' module name, so normalize for that.
                    pkgConfig = getOwn(config.pkgs, (pkgName = name[0]));
                    name = name.join('/');
                    if (pkgConfig && name === pkgName + '/' + pkgConfig.main) {
                        name = pkgName;
                    }
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundMap) {
                        break;
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            return name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                removeScript(id);
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);
                context.require([id]);
                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        normalizedName = normalize(name, parentName, applyMap);
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length - 1, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return mod.exports;
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            var c,
                                pkg = getOwn(config.pkgs, mod.map.id);
                            // For packages, only support config targeted
                            // at the main module.
                            c = pkg ? getOwn(config.config, mod.map.id + '/' + pkg.main) :
                                      getOwn(config.config, mod.map.id);
                            return  c || {};
                        },
                        exports: defined[mod.map.id]
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var map, modId, err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                map = mod.map;
                modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            if (this.map.isDefine) {
                                //If setting exports via 'module' is in play,
                                //favor that over return value and exports. After that,
                                //favor a non-undefined return value over exports use.
                                cjsModule = this.module;
                                if (cjsModule &&
                                        cjsModule.exports !== undefined &&
                                        //Make sure it is not already the exports value
                                        cjsModule.exports !== this.exports) {
                                    exports = cjsModule.exports;
                                } else if (exports === undefined && this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths and packages since they require special processing,
                //they are additive.
                var pkgs = config.pkgs,
                    shim = config.shim,
                    objs = {
                        paths: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (prop === 'map') {
                            if (!config.map) {
                                config.map = {};
                            }
                            mixin(config[prop], value, true, true);
                        } else {
                            mixin(config[prop], value, true);
                        }
                    } else {
                        config[prop] = value;
                    }
                });

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;
                        location = pkgObj.location;

                        //Create a brand new object on pkgs, since currentPackages can
                        //be passed in again, and config.pkgs is the internal transformed
                        //state for all package configs.
                        pkgs[pkgObj.name] = {
                            name: pkgObj.name,
                            location: location || pkgObj.name,
                            //Remove leading dot in main, so main paths are normalized,
                            //and remove any trailing .js, since different package
                            //envs have different conventions: some use a module name,
                            //some use a file name.
                            main: (pkgObj.main || 'main')
                                  .replace(currDirRegExp, '')
                                  .replace(jsSuffixRegExp, '')
                        };
                    });

                    //Done with modifications, assing packages back to context config
                    config.pkgs = pkgs;
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overriden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, pkgs, pkg, pkgPath, syms, i, parentModule, url,
                    parentPath;

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;
                    pkgs = config.pkgs;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');
                        pkg = getOwn(pkgs, parentModule);
                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        } else if (pkg) {
                            //If module name is just the package name, then looking
                            //for the main module.
                            if (moduleName === pkg.name) {
                                pkgPath = pkg.location + '/' + pkg.main;
                            } else {
                                pkgPath = pkg.location;
                            }
                            syms.splice(0, i, pkgPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));

define("requireLib", function(){});


define('common/util',['require','exports','module'],function(require, exports, module) {

	//Empty init
	var initEmpty = function(){};

	//Proxy Constructor (for once)
	var Proxy = function(x){
		util.defineProperty(this,'_protoOf',{value:x});
	};

	var util = {

		is : function(o, type){
			return ({}).toString.call(o) === '[object '+type+']';
		},

		defineProperty : function(obj, prop, descriptor){
			if(typeof Object.defineProperty==='function'){
				Object.defineProperty(obj, prop, descriptor);
			}else{
				obj[prop] = descriptor.value;
			}
		},

		copyOwnProperties : function(src, target){
			if(src instanceof Object){
				var k;
				for(k in src){
					if(src.hasOwnProperty(k)){
						target[k] = src[k];
					}
				}
			}
		},

		/**
		 * Define Class
		 *
		 * @method defineClass
		 * @param {Object} p
		 * @returns {Function} Constructor
		 */
		Class : function(p) {

			var dynamics = p.dynamics || {},
				statics = p.statics || {};
				dynamics.init = p.init || initEmpty;

			//Constructor
			var Clazz = function(){
				util.defineProperty(this,'_type',{value:p.name||''});
				if(Clazz.prototype.hasOwnProperty('init')){
					Clazz.prototype.init.apply(this, arguments);
				}
			};

			//Extend Dynamics
			var Extend = p.extend || Object;
			Proxy.prototype = Extend.prototype;
			Clazz.prototype = new Proxy(p.name);
			this.defineProperty(Clazz.prototype,'constructor',{value:Clazz});

			//Extend Statics
			this.copyOwnProperties(Extend, Clazz);

			// overwrite Extend.super
			this.defineProperty(Clazz,'super',{value:Extend.prototype});

			//Add Dynamics
			this.copyOwnProperties(dynamics, Clazz.prototype);

			//Add Statics (if exist override)
			this.copyOwnProperties(statics, Clazz);

			return Clazz;
		},

		/**
		 * Define Interface
		 *
		 * @param {Object} p 
		 * @returns {Function} Constructor Function
		 */
		Interface : function(p) {
			//TODO
		}
	};

	module.exports = util;
});


define('common/string',['require','exports','module'],function(require, exports, module) {

	module.exports = {
		trim : function(str){
    		return str.replace(/^\s+|\s+$/g, '');
		},
		ucFirst : function(str){
			return str.substr(0,1).toUpperCase() + str.substr(1);
		},
		getRandomColor : function () {
			var letters = '0123456789ABCDEF'.split('');
			var color = '#';
			for (var i = 0; i < 6; i++ ) {
				color += letters[Math.round(Math.random() * 15)];
			}
			return color;
		},
		round : function(str, precision){
		    
		    var power = Math.pow(10,precision);
		    
		    return Math.round(parseFloat(str)*power)/power;
		},
		getRandomNum : function(start, end){
			var diff = end - start;
			return Math.round(Math.random()*diff)+start;
		}
	}

});


define('bases/Registry',['require','exports','module'],function(require, exports, module) {

	var registry = {};

	module.exports = {
		getRegistry : function(){
			return registry;
		},
		registerByType : function(type, instance, family){
			var sup;
			if(typeof registry[type] ==='undefined'){
				registry[type] = {};
			}
			registry[type][instance.id] = instance;
			if(sup = family.constructor.super){
				if(sup._protoOf){
					this.registerByType(sup._protoOf, instance, sup);
				}
			}
		},
		register : function(instance){
			if(instance.id){
				this.registerByType(instance._type, instance, instance);
			}
		},
		getObjectById : function(id, type){
			var result;
			if(type){
				result = registry[type][id];
				if(!result){
					
				}
			}else{
				result = registry['BaseObject'][id];
				if(!result){
					
				}
			}
			return result;
		}
	};
});

define('bases/BaseObject',['require','exports','module','common/util','common/string','bases/Registry'],function(require, exports, module) {

	var util = require('common/util'),
		string = require('common/string'),
		Registry = require('bases/Registry');

	var _uid = 0;

	var checkProperty = function(that, key){
		if(!(key in that)){
			throw new Error(key+' property does not exists');
		}
	}

	var BaseObject = util.Class({
		name : 'BaseObject',
		extend : Object,
		init : function(p){
			util.defineProperty(this,'_uid',{value:++_uid});
			if(typeof p === 'object'){
				util.defineProperty(this,'id',{value:p.id || null});
				Registry.register(this);
			}
		},
		dynamics : {
			get : function(key){
				checkProperty(this, key);
				var getter = 'get'+string.ucFirst(key);
				if(this[getter]){
					return this[getter]();
				}else{
					return this[key];
				}
			},
			set : function(key, value){
				checkProperty(this, key);
				var setter = 'set'+string.ucFirst(key);
				if(this[setter]){
					this[setter](value);
				}else{
					this[key] = value;
				}
			},
			setAssoc : function(key1, key2, value){
				var obj = this.get(key1);
				if(typeof obj!='object'){
					throw new Error(key1+' property value is not object');
				}
				obj[key2] = value;
				this.set(key1, obj);
			}
		},
		statics : {
			create : function(p){
				return new this(p);
			},
			getType : function(){
				return (new this())._type;
			},
			isEmpty : function(obj){
			    for(var prop in obj){
			        if(obj.hasOwnProperty(prop)){return false;}
			    }
			    return true;
			}
		}
	});

	module.exports = BaseObject;
});

define('common/dom',['require','exports','module','common/string'],function(require, exports, module) {

	var string = require('common/string');

	module.exports = {
		byId : function(id){
			return document.getElementById(id);
		},
		byTag : function(tagName){
			return document.getElementsByTagName(tagName);
		},
		bySelector : function(selector, element){
			element = element || document;
			return element.querySelectorAll(selector);
		},
		getAppliedStyleClone : function(element){
			var prop, result=new Object();
			for(prop in element.style){
				result[prop] = element.style[prop];
			}
			return result;
		},
		getComputedStyleClone : function(element){
			var styles = window.getComputedStyle(element),
				len = styles.length, i, prop,
				result = {};
			for(i=0; i<len; i++){
				prop = styles[i];
				//result[prop] = styles[prop];
				result[prop] = styles.getPropertyValue(prop);
			}
			return result;
		},
		getComputedStyleDiff : function(styleOrg, styleVar){
			var prop, result={};
			for(prop in styleOrg){
				if(styleOrg[prop]!=styleVar[prop]){
					result[prop] = styleVar[prop];
				}
			}
			return result;
		},
		checkComputedStyleDiff : function(styleOrg, styleVar){
			var i, check=false, result = this.getComputedStyleDiff(styleOrg, styleVar);
			for(i in result){
				//
				check=true;
			}
			return check;
		},
		getStyle : function(element, prop){
			var styles = window.getComputedStyle(element);
			//return styles[prop];
			return styles.getPropertyValue(prop);
		},
		setStyles : function(element, propSet){
			//
			var prop, style=element.style;
			for(prop in propSet){
				style.setProperty(prop, propSet[prop]);
			}
		},
		makeElement : function(tag, properties, where, win){
			if(typeof win=='undefined') {win = window;}
			var element = win.document.createElement(tag);
			win.document.body.appendChild(element) ;
			if(properties){
				for (var p in properties) {
					element[p] = properties[p] ;
				}
			}
			if(where){
				this.addElement(element, where.element, where.position) ;
			}else{
				win.document.body.appendChild(element) ;
			}
			return element;
		},
		/**
		 * @param {element} newElement
		 * @param {element} where
		 * @param {String} pos : 'before', 'after', 'inside'
		 */
		addElement : function(newElement, where, pos){
			if(pos=='after' || pos==undefined){
				where.parentNode.insertBefore(newElement, where.nextSibling) ;
			}else if(pos=='before'){
				where.parentNode.insertBefore(newElement, where) ;
			}else if(pos=='inside'){
				where.appendChild(newElement);
				//where.insertBefore(newElement, where.lastChild) ;
			}
		},
		nodeType : {
			1 : 'ELEMENT_NODE',
			2 : 'ATTRIBUTE_NODE',
			3 : 'TEXT_NODE',
			4 : 'CDATA_SECTION_NODE',
			5 : 'ENTITY_REFERENCE_NODE',
			6 : 'ENTITY_NODE',
			7 : 'PROCESSING_INSTRUCTION_NODE',
			8 : 'COMMENT_NODE',
			9 : 'DOCUMENT_NODE',
			10 : 'DOCUMENT_TYPE_NODE',
			11 : 'DOCUMENT_FRAGMENT_NODE',	
			12 : 'NOTATION_NODE'
		},
		prepareNode : function(){
			if(typeof window.Node === 'undefined'){
				for(i in this.nodeType){
					window.Node[this.nodeType[i]] = i;
				}
			}
		},
		cloneNode : function(element, isRecursive){
			var clone;
			switch(element.nodeType){
				//Now we just copy ELEMENT, TEXT NODE
				case Node.ELEMENT_NODE :
					//refer to element.attributes
					//Now we just copy id and class to clone
					//If you need more add it then.
					clone = document.createElement(element.nodeName);
					clone.id = element.id;
					clone.className = element.className;
					this.setStyles(clone, this.getComputedStyleClone(element));
					break;
				case Node.TEXT_NODE :
					clone = document.createTextNode(element.nodeValue);
					//if(string.trim(clone.nodeValue)){clone.nodeValue = 'c_'+clone.nodeValue;}
					break;
				default :
			}
			return clone;
		},
		shadowNode : function(element, isRecursive){
			this.prepareNode();
			//var clone = element.cloneNode(false);
			var clone = this.cloneNode(element, false);
			//var clone;
			switch(element.nodeType){
				case Node.ELEMENT_NODE :
//					
					this.setStyles(clone, {visibility: 'hidden'});
					if(clone.id){clone.id = 'clone_'+clone.id;} //TODO : selector case
					if(element.hasChildNodes()){
						var child;
						for(child=element.firstChild; child != null; child = child.nextSibling){
							clone.appendChild(this.shadowNode(child, isRecursive));
						}
					}
					break;
				case Node.TEXT_NODE :
//					
					break;
				default :
					
			}
			return clone;
		},
		cloneElement : function(element, position){
			
			var i, childNode, nodeType;
			var properties = {id:'clone_'+element.id};
			var newElement = this.makeElement(element.nodeName, properties, {
				element:element, position:position || 'after'
			});
			newElement.innerHTML = properties.id;
			return newElement;
		},
		addEvent : function(element, eventName, eventHandler){ 
			if(element.addEventListener){
				element.addEventListener(eventName, eventHandler, false);
			}else{
				element.attachEvent('on'+eventName, eventHandler);
			}
			return eventHandler;
		},
		removeEvent : function(element, eventName, eventHandler){
			if(element.addEventListener){
				element.removeEventListener(eventName, eventHandler, false);
			}else{
				element.detachEvent('on'+eventName, eventHandler);
			}
		},
		createEvent : function(eventName, data, bubbles, cancelable, noBundle) {
			var oEvent = document.createEvent('Events');
			oEvent.initEvent(eventName, bubbles, cancelable);
			if(!noBundle){oEvent.bundle = {};}
			if(data){
				for(var i in data) {
					if(data.hasOwnProperty(i)){
						if(noBundle){
							oEvent[i] = data[i];
						}else{
							oEvent.bundle[i] = data[i];
						}
					}
				}
			}
			return oEvent;
		},
		dispatchEvent : function(element, eventName, data, bubbles, cancelable, noBundle){
			var id = element.id ? ':'+element.id : '';
			if(eventName != 'aniGroupTimeUpdate'){
				
			}
			if(element.fireEvent){
				element.fireEvent('on'+eventName);
				//TODO bundle
			}else if(element.dispatchEvent){
				element.dispatchEvent(this.createEvent(eventName, data, bubbles, cancelable, noBundle));
			}
		},
		hide : function(id){
			var element = this.byId(id);
			if(element){
				element.style.display = 'none';
			}
		},
		/**
		 * @param {element} element
		 * @param {String} pos : 'Left', 'Top'
		 */
		getAbsPos : function(element, pos){
			var result = 0;
			while(element.offsetParent){
				result += element['offset'+pos];
				element = element.offsetParent;
			}
			return result;
		}
	};

});


define('common/css',['require','exports','module','common/string'],function(require, exports, module) {

	var string = require('common/string');

	var css = {
		propPrefix : 'webkit',
		eventPrefix : 'webkit',
		inlinePrefix : '-webkit-',
		detectPrexfix : function(){
			
			if(document.body){
				var style = document.body.style;
				if(style['webkitAnimation'] != undefined){
					this.propPrefix = 'webkit';
					this.eventPrefix = 'webkit';
					this.inlinePrefix = '-webkit-';
				}else if(style['MozAnimation'] != undefined){
					this.propPrefix = 'Moz';
					this.eventPrefix = '';
					this.inlinePrefix = '';
				}else if(style['animation'] != undefined){
					this.propPrefix = '';
					this.eventPrefix = '';
					this.inlinePrefix = '';
				}
			}
			
			
		},
		fixProp : function(prop){
			if(this.propPrefix){
				prop = this.propPrefix+string.ucFirst(prop);
			}
			return prop;
		},
		fixInline : function(prop){
			if(this.inlinePrefix){
				prop = this.inlinePrefix+prop;
			}
			return prop;
		},
		fixEvent : function(eventName){
			if(this.eventPrefix){
				eventName = this.eventPrefix+string.ucFirst(eventName);
			}else{
				eventName = eventName.toLowerCase();
			}
			return eventName;
		},
		insertRule : function(styleSheet, selector, cssDesc, pos){
			
			if(styleSheet.insertRule){
				styleSheet.insertRule(selector+'{'+cssDesc+'}',pos);
			}else if(styleSheet.addRule){
				styleSheet.addRule(selector,cssDesc,pos);
			}else{
				throw new Error('insertRule() not supported');
			}
		},
		setAnimation : function(element, prop){
			
			element.style[this.fixProp('animationName')] = prop.name;
			element.style[this.fixProp('animationDelay')] = prop.delay;
			element.style[this.fixProp('animationFillMode')] = prop.fillmode;
			element.style[this.fixProp('animationDuration')] = prop.duration;
			element.style[this.fixProp('animationDirection')] = prop.direction;
			element.style[this.fixProp('animationTimingFunction')] = prop.timing;
			element.style[this.fixProp('animationIterationCount')] = prop.iteration;
			element.style[this.fixProp('animationPlayState')] = 'running';
			
			//
		},
		resetAnimation1 : function(element){
			
			try{
				delete element.style[this.fixProp('animation')];
				delete element.style[this.fixProp('animationName')];
				delete element.style[this.fixProp('animationDelay')];
				delete element.style[this.fixProp('animationFillMode')];
				delete element.style[this.fixProp('animationDuration')];
				delete element.style[this.fixProp('animationDirection')];
				delete element.style[this.fixProp('animationTimingFunction')];
				delete element.style[this.fixProp('animationIterationCount')];
				//delete element.style[this.fixProp('animationPlayState')];
			}catch(e){
				
			}
		},
		resetAnimation : function(element){
			
			var style = element.style;
			try{
				delete style[this.fixProp('animation')];
				delete style[this.fixProp('animationName')];
				delete style[this.fixProp('animationDelay')];
				delete style[this.fixProp('animationFillMode')];
				delete style[this.fixProp('animationDuration')];
				delete style[this.fixProp('animationDirection')];
				delete style[this.fixProp('animationTimingFunction')];
				delete style[this.fixProp('animationIterationCount')];
				style[this.fixProp('animation')] = '';
				style[this.fixProp('animationName')] = '';
				style[this.fixProp('animationDelay')] = '';
				style[this.fixProp('animationFillMode')] = '';
				style[this.fixProp('animationDuration')] = '';
				style[this.fixProp('animationDirection')] = '';
				style[this.fixProp('animationTimingFunction')] = '';
				style[this.fixProp('animationIterationCount')] = '';
				style[this.fixProp('animationPlayState')] = '';
			}catch(e){
				
			}
		}
	};

	css.detectPrexfix();

	module.exports = css;

});


define('common/env',['require','exports','module','common/css'],function(require, exports, module) {

	var css = require('common/css');

	module.exports = {
		agent : null,
		useJQuery : false,
		init : function(p){
			
			this.detectAgent();
			this.setJQuery(p.useJQuery);
		},
		setJQuery : function(useJQuery){
			if(typeof jQuery !='undefined' && useJQuery){
				this.useJQuery = true;
			}
		},
		detectAgent : function(){
			
			var userAgent = window.navigator.userAgent;
			
			if((/ Qt/ig).test(userAgent)){
				this.agent = 'qt';
			}else if((/ OPR/ig).test(userAgent)){
				this.agent = 'opera';
			}else if((/ Chrome/ig).test(userAgent)){
				this.agent = 'chrome';
			}else if((/ Safari/ig).test(userAgent)){
				this.agent = 'safari';
			}else if((/ Firefox/ig).test(userAgent)){
				this.agent = 'firefox';
			}else if((/ MSIE/ig).test(userAgent)){
				this.agent = 'ie';
			}
			
		}
	};
});


define('events/Event',['require','exports','module','common/util','common/env','common/dom','bases/Registry','bases/BaseObject'],function(require, exports, module) {

	var util = require('common/util'),
		env = require('common/env'),
		dom = require('common/dom'),
		Registry = require('bases/Registry'),
		BaseObject = require('bases/BaseObject');

	var Event = util.Class({
		name : 'Event',
		extend : BaseObject,
		init : function(p){
			Event.super.init.apply(this, arguments);
		},
		dynamics : {
		},
		statics : {
			create : function(p){
//				
//				
//				
//				
				if(env.useJQuery){
					//
				}else{
					dom.addEvent(p.element, p.eventName, function(oEvent){
						
						//TODO : How can we control cases
						if(p.type==='AniGroup'){
							var aniGroup = Registry.getObjectById(p.target, 'AniGroup');
							aniGroup[p.act]();
						}
					});
				}
				
				return new this(p);
			}
		}
	});

	module.exports = Event;
});

define('dom/Dom',['require','exports','module','common/util','common/dom','common/string','bases/BaseObject','events/Event'],function(require, exports, module) {

	var util = require('common/util'),
		dom = require('common/dom'),
		string = require('common/string'),
		BaseObject = require('bases/BaseObject'),
		Event = require('events/Event');

	var Dom = util.Class({
		name : 'Dom',
		extend : BaseObject,
		init : function(p, element){
			Dom.super.init.apply(this, arguments);
			this.set('element', element);
			this.set('style', this.element.style);
			this.set('events', new Object());
			
			if(p.events){
				//
				var eventName, eventSet, i;
				for(eventName in p.events){
					if(!this.events[eventName]){
						this.events[eventName] = new Array();
					}
					eventSet = p.events[eventName];
					for(i=0; i<eventSet.length; i++){
						this.events[eventName].push(Event.create({
							id : eventSet[i].id,
							element : this.element,
							eventName : eventName,
							type : eventSet[i].type,
							target : eventSet[i].target,
							act : eventSet[i].act
						}));
					}
				}
			}
		},
		dynamics : {
			style : null,
			element : null,
			events : null
		},
		statics : {
			create : function(p){
				if(typeof p.element === 'object'){
					return new this(p, p.element);
				}else if(p.id && dom.byId(p.id)){
					var oid = p.id;
					var i, r=new Object();
					for(i in p){
						r[i] = p[i];
					}
					r.id = 'dom'+string.ucFirst(r.id);
					return new this(r, dom.byId(oid));
				}
			}
		}
	});

	module.exports = Dom;
});

define('nodes/Node',['require','exports','module','common/util','common/dom','bases/BaseObject','dom/Dom'],function(require, exports, module) {

	var util = require('common/util'),
		dom = require('common/dom'),
		BaseObject = require('bases/BaseObject'),
		Dom = require('dom/Dom');

	var Node = util.Class({
		name : 'Node',
		extend : BaseObject,
		init : function(p){
			Node.super.init.apply(this, arguments);
			this.set('children', new Array());
			this.set('dom', Dom.create(p));
		},
		dynamics : {
			parent : null,
			children : null,
			dom : null,
			visible : true,
			addChild : function(child){
				this.children.push(child);
				child.set('parent', this);
				return this;
			},
			hasChildren : function(){
				return this.children.length > 0;
			},
			hasParent : function(){
				return (this.parent instanceof this.constructor);
			},
			getChildById : function(id){
				var i;
				for(i in this.children){
					if(this.children[i]['id']===id){
						return this.children[i];
					}
				}
			},
			runAction : function(action){
			    //TODO : ActionManager.add(action, this);
				action.runWith(this);
			},
			pauseAction : function(action){
				action.pauseWith(this);
			},
			resumeAction : function(action){
				action.resumeWith(this);
			},
			stopAction : function(action){
			    //TODO : ActionManager.remove(action, this);
				action.stopWith(this);
			},
			setVisible : function(isVisible){
				this.visible = isVisible;
				if(this.dom){
					var style = this.dom.style;
					style.visibility = isVisible ? 'visible' : 'hidden';
				}
			},
			show : function(){
				if(this.dom){
					var style = this.dom.style;
					style.display = 'block';
				}
			},
			hide : function(){
				if(this.dom){
					var style = this.dom.style;
					style.display = 'none';
				}
			}
		},
		statics : {
		}
	});

	module.exports = Node;
});

define('common/logger',['require','exports','module'],function(require, exports, module) {

	module.exports = {
		log : function(){
			
		},
		event : function(str){
			this.log('%c   ====> '+str+'\r\n', 'color:#4CC552');
		},
		check : function(obj, name){
			var result='';
			if(!name){name = '';}else{name = name+'.';}
			for(var p in obj){
				result += '\t'+name+p+' = '+obj[p]+'\n';
			}
			//return result;
		}
	}

});


define('bases/Timer',['require','exports','module'],function(require, exports, module) {

	var uid=0, timers={};

	module.exports = {
		getTimer : function(uid){
			return timers[uid];
		},
		repeat : function(p){
			var onRepeat = p.onRepeat || function(){},
				duration = p.duration || 1000,
				iteration = p.iteration || 1, 
				immediately = p.immediately || true, 
				onEnd = p.onEnd || function(){},
				bundle = p.bundle || {};
			var timer = timers[++uid] = {
				id : null,
				type : 'repeat',
				duration : duration,
				iteration : iteration,
				step : 0,
				paused : false,
				startMs : 0,
				progress : 0,
				bundle : bundle,
				onRepeat : onRepeat,
				onEnd : onEnd
			};
			if(immediately){
				++timer.step;
				timer.startMs = (new Date()).getTime();
				onRepeat(bundle);
			}
			timer['id'] = setInterval(function(bundle){
				if(++timer.step <= timer['iteration']){
					timer.startMs = (new Date()).getTime();
					onRepeat(bundle);
				}else{
					onEnd(bundle);
					clearInterval(timer['id']);
				}
			},timer['duration'],bundle);
			return uid;
		},
		setInterval : function(func, msec){
			timers[++uid] = {
				type : 'interval',
				id : setInterval(func, msec)
			};
			return uid;
		},
		setTimeout : function(func, msec){
			timers[++uid] = {
				type : 'interval',
				id : setTimeout(func, msec)
			};
			return uid;
		},
		pause : function(u){
			var timer = timers[u],
				type = timer['type'];
			switch(type){
				case 'interval' :
					//TODO
					break;
				case 'timeout' :
					//TODO
					break;
				case 'repeat' :
					var elapsed = (new Date()).getTime()-timer['startMs'];
					timer['progress'] = elapsed/timer['duration'];
					timer['paused'] = true;
					clearInterval(timer['id']);
					clearInterval(timer['timeout']);
					break;
			}
		},
		resume : function(u, callback){
			var timer = timers[u],
				type = timer['type'];
			switch(type){
				case 'interval' :
					//TODO
					break;
				case 'timeout' :
					//TODO
					break;
				case 'repeat' :
					timer.paused = false;
					

					//남은 시간동안 진행한다

					callback();

					++timer.step;

					var ms = (1-timer['progress'])*timer['duration'];

					timer['timeout'] = setTimeout(function(timer){
						
						var onRepeat = timer.onRepeat;
						var onEnd = timer.onEnd;
						var bundle = timer.bundle;

						timer.startMs = (new Date()).getTime();
						onRepeat(bundle);

						timer['id'] = setInterval(function(bundle){
							if(++timer.step <= timer['iteration']){
								timer.startMs = (new Date()).getTime();
								onRepeat(bundle);
							}else{
								onEnd(bundle);
								clearInterval(timer['id']);
							}
						},timer['duration'],bundle);

					},ms,timer);

					break;
			}
		},
		clear : function(u){
			var timer = timers[u],
				type = timer['type'];
			switch(type){
				case 'interval' :
					clearInterval(timer['id']);
					break;
				case 'timeout' :
					clearTimeout(timer['id']);
					break;
				case 'repeat' :
					clearInterval(timer['id']);
					break;
			}
		},
		sleep : function(delay) {
			var start = new Date().getTime();
			while (new Date().getTime() < start + delay);
		}
	};
});

define('actions/Action',['require','exports','module','common/util','bases/BaseObject'],function(require, exports, module) {

	var util = require('common/util'),
		BaseObject = require('bases/BaseObject');

	var Action = util.Class({
		name : 'Action',
		extend : BaseObject,
		init : function(p){
			Action.super.init.apply(this, arguments);
		},
		dynamics : {
			target : null,
			state : 'stop',
			runWith : function(node){
				this.set('target',node);
				this.set('state','run');
			},
			pauseWith : function(node){
				if(this.get('state')==='run'){
					this.set('state','pause');
				}
			},
			resumeWith : function(node){
				if(this.get('state')==='pause'){
					this.set('state','run');
				}
			},
			stopWith : function(node){
				this.set('target',null);
				this.set('state','stop');
			}
		},
		statics : {
		}
	});

	module.exports = Action;
});

define('actions/Animate',['require','exports','module','common/util','common/env','common/logger','common/string','common/dom','common/css','bases/Registry','actions/Action'],function(require, exports, module) {

	var util = require('common/util'),
		env = require('common/env'),
		logger = require('common/logger'),
		string = require('common/string'),
		dom = require('common/dom'),
		css = require('common/css'),
		Registry = require('bases/Registry'),
		Action = require('actions/Action');

	var subLen = 10;
	if(css.inlinePrefix.length){
		subLen = 10 + css.inlinePrefix.length;
	}
	

	var Animate = util.Class({
		name : 'Animate',
		extend : Action,
		init : function(p){
			Animate.super.init.apply(this, arguments);
			this.set('delay', p.delay || '0s');
			this.set('duration', p.duration || '0s');
			this.set('iteration', p.iteration || 1);
			if(this.iteration==='infinite'){
				this.iteration = Number.MAX_VALUE/10000000;
			}
			this.set('direction', p.direction || 'normal');
			this.set('fillmode', p.fillmode || 'forwards');
			this.set('timing', p.timing || 'ease');
			if(p.justplay===true){
				this.set('justplay', true);
			}else{
				this.set('justplay', false);
			}
			this.set('holdEnd', p.holdEnd || false);
			this.set('handlers', {
				start : function(){},
				iteration : function(){},
				end : function(){},
				resumeTime : function(){}
			});
			if(p.handlers){
				if(typeof p.handlers.start==='function'){
					this.setAssoc('handlers','start',p.handlers.start);
				}
				if(typeof p.handlers.iteration==='function'){
					this.setAssoc('handlers','iteration',p.handlers.iteration);
				}
				if(typeof p.handlers.end==='function'){
					this.setAssoc('handlers','end',p.handlers.end);
				}
				if(typeof p.handlers.resumeTime==='function'){
					this.setAssoc('handlers','resumeTime',p.handlers.resumeTime);
				}
			}
			this.set('delayRemain', parseFloat(this.delay)*1000);
			this.set('totalDuration', parseFloat(this.duration)*this.iteration*1000);
			this.set('currentTime', -1*this.delayRemain);
		},
		dynamics : {
			delay : null,
			duration : null,
			iteration : null,
			direction : null,
			fillmode : null,
			timing : null,
			justplay : null,
			handlers : null,
			holdEnd : null,
			iterated : 0,
			beforeCss : null,
			originCss : null,
			startCss : null,
			endCss : null,
			startMs : 0,
			delayRemain : null, //Check the animation is in a running state or not (To process delayed animations)
			currentTime : 0,
			timelineState : 0,
			totalDuration : 0,
			noMove : false,
			bindAnimation : function(element, prop){
				
				prop.name = prop.id;
				css.setAnimation(element, prop);
				this.updateStartMs();
			},
			unbindAnimation : function(){
				
				if(this.target){
					var element = this.target.dom.element;
					css.resetAnimation(element);
					var clone = dom.byId('clone_'+element.id);
					if(clone){css.resetAnimation(clone);}
				}
			},
			updateStartMs : function(){
				this.set('startMs', (new Date()).getTime());
			},
			runWithDelay : function(element, delayMs){
				
				this.bindAnimation(element, {
					id : this.id,
					delay : (delayMs/1000)+'s',
					fillmode : this.fillmode,
					duration : this.duration,
					direction : this.direction,
					timing : this.timing,
					iteration : this.iteration,
					playState : 'running'
				});
			},
			setStartPos : function(node){
				
				if(this.endCss){
					this.beforeCss = this.endCss;
				}
				if(this.startCss){
					this.setStyleByDiff(node.dom.element, this.startCss);
				}
			},
			runWith : function(node){
				//this.target HOW? TODO:
				

				//set start state
				this.setStartPos(node);

				//unbind if exists and reset conditional vars
				this.unbindAnimation();
				this.resetStates();

				
				
				//
				//
				if(this.target && this.target._uid===node._uid){
					this.stopWith(this.target);
				}
				setTimeout(function(that, args, node){
					Animate.super.runWith.apply(that, args);
					that.bindAnimation(node.dom.element, that);
				},1,this,arguments,node);
				
			},
			pauseWith : function(node){
				
				var style = node.dom.style;
				//
				if(style[css.fixProp('animationName')] && this.state==='run'){
					Animate.super.pauseWith.apply(this, arguments);

					//delayed and before run
					if(this.delayRemain > 0){
						var delta = (new Date()).getTime() - this.startMs; //played time
						this.set('delayRemain', this.delayRemain - delta);
						
						
					}

					//not yet run
					if(this.delayRemain > 0){
						var log = '    @@ delayed : this.id = '+this.id+', ';
							log += 'this.target.id = '+this.target.id+", ";
							log += "style[css.fixProp('animationDelay')] = "+style[css.fixProp('animationDelay')];
						
						this.unbindAnimation();
					//in run state
					}else{
						style[css.fixProp('animationPlayState')] = 'paused';
					}
				}
			},
			resumeWith : function(node){
				
				var style = node.dom.style;
				this.set('timelineState', 0);
				if(style[css.fixProp('animationName')] && this.state==='pause'){
					Animate.super.resumeWith.apply(this, arguments);
					style[css.fixProp('animationPlayState')] = 'running';
				}
				//delayed before run
				if(this.delayRemain > 0 && this.state==='pause'){
					
					Animate.super.resumeWith.apply(this, arguments);
					//
					this.runWithDelay(node.dom.element, this.delayRemain);
				}
			},
			resetStates : function(){
				
				this.set('startMs', 0);
				this.set('timelineState', 0);
				this.set('iterated', 0);
				this.set('delayRemain', parseFloat(this.delay)*1000); //init again
				this.set('currentTime', -1*this.delayRemain);
			},
			stopWith : function(node){
				
				//to hold end state
				
				if(this.holdEnd===true && this.target){
					this.detectEndCss();
					this.beforeCss = this.startCss;
					this.setStyleByDiff(this.target.dom.element, this.endCss, true);
				}
				this.unbindAnimation();
				this.resetStates();
				Animate.super.stopWith.apply(this, arguments);
			},
			detectStyleWith : function(node){
				
				this.detectOriginCss(node);
				setTimeout(function(that,node){
					that.detectStartCss(node);
				},1,this,node);
			},
			detectOriginCss : function(node){
				
				var element = node.dom.element;
                var originCss = Animate.getCloneStyle(element);
				this.set('originCss', originCss);
				
				
			},
			detectStartCss_old : function(node){
				
                var element = node.dom.element;
                var clone = dom.byId('clone_'+element.id);
				this.set("timelineState", Animate.IS_DETECT_START), 
				this.set("target", node), 
				this.runWithDelay(clone, 0);
			},
			detectStartCss : function(node){
				
				var element = node.dom.element;
				var clone = dom.byId('clone_'+element.id);

//				
//                

                //Bind with pause
                this.bindAnimation(clone, {
                    id : this.id,
                    delay : '0s',
                    fillmode : this.fillmode,
                    duration : this.duration,
                    direction : this.direction,
                    timing : this.timing,
                    iteration : this.iteration,
                    playState : 'pause'
                });

                //startStyle
                var startCss = Animate.getCloneStyle(clone);
				this.set('startCss', startCss);
				//
				
				

				//add new styles of startCss to origin
/*
				for(var p in startCss){
					if(typeof this.originCss[p] === 'undefined'){
						this.originCss[p] = startCss[p];
					}
				}
*/
//				
//				
                //
                //

                setTimeout(function(clone,node,animate){
                    //Reset Animation
                    css.resetAnimation(clone);
                    //fire onSetTime event
                    dom.dispatchEvent(node.dom.element, 
                        Animate.DETECT_START_CSS, {
                            animate : animate,
                            node : node
                        },true,true);

                },0,clone,node,this);
			},
			detectEndCss : function(){
				
				if(this.target!=null){
					this.set('endCss', Animate.getCloneStyle(this.target.dom.element));
					
					
				}
			},
			setStyleByDiff : function(element, style, isLog){
				
				if(this.beforeCss==null){
					this.beforeCss = this.originCss;
				}

				var diff = dom.getComputedStyleDiff(this.beforeCss, style);
				if(isLog){}
				//if(1){}
				dom.setStyles(element, diff);

				this.beforeCss = style;

				//fire onSetTime event
				Animate.dispatchSetTimeEvent(
					element, 
					'#'+element.id, //TODO modify to Selector 
					this.currentTime,
					this);
			},
			goToStartFrameWith : function(node){
				
				var element = node.dom.element;
				this.stopWith(node); //reset all
				this.setStyleByDiff(element, this.startCss);
			},
			resumeTimeWith : function(node){
				
				this.set('timelineState', Animate.IS_RESUME_TIME);
				this.set('state', 'run');
				this.set('target', node);
				this.runWithDelay(node.dom.element, -1*this.currentTime);
				//resume position is -1*this.currentTime
				//2013.09.17 until now here
				//TODO : run() then setCurrentTime(), Eliminate aniImage2ing
				//Refer to prototyping html of setCurrentTime
			},
			update : function(durationMs, delayMs){
				

				if(typeof delayMs != 'undefined'){
					var delayDelta = delayMs - parseFloat(this.delay)*1000;
					var delayRemain = this.delayRemain + delayDelta;
					
					if(delayRemain < 0){
						
						delayRemain = 0;
					}
					this.set('delay', (delayMs/1000)+'s');
					this.set('delayRemain', delayRemain);
					this.set('currentTime', this.currentTime - delayDelta);
					
				}

				if(typeof durationMs != 'undefined'){
					this.set('duration', (durationMs/1000)+'s');
					this.set('totalDuration', durationMs*this.iteration);
					this.set('iterated', Math.floor(this.currentTime/durationMs));
				}
				
			},
			setTimeWith : function(node, msec, ignoreDelta){
				

				
				
				if(parseFloat(this.duration)==0){
					
					
					return;
				}
				var element = node.dom.element;
				var delta = Math.abs(this.currentTime - msec);

				

				var actualPos = parseFloat(this.delay)*1000 + msec;
				

				//start position
				if(actualPos==0){
					this.unbindAnimation();
					this.resetStates();
				}else{
					//pass under 0.1ms
					if(delta <= 0.5 && !ignoreDelta){
						
						return;
					}
				}

				this.set('currentTime', msec);
				this.set('timelineState', Animate.IS_SET_TIME);
				if(msec < this.totalDuration){
					this.set('state', 'pause');
				}else{
					this.set('state', 'stop');
				}

				// 0. origin running state
				if(element.style[css.fixProp('animationPlayState')]==='running'){
					this.unbindAnimation();
					element.style.visibility = 'hidden'; //hide temporally
				}

				// 1. Clone
				var clone = dom.byId('clone_'+element.id);

				// + avoid overlap of running
				if(	clone.style[css.fixProp('animationName')]!='none' && 
					clone.style[css.fixProp('animationPlayState')]==='running'){
					
					

					//QT BUG FIX
					if(env.agent==='qt'){
						setTimeout(function(clone){
							css.resetAnimation(clone);
						},1,clone);
					}else{
						css.resetAnimation(clone);
					}
				}

				// + paused state
				if(	element.style[css.fixProp('animationName')]!=='' && 
					element.style[css.fixProp('animationPlayState')]==='paused'){
					
					this.unbindAnimation();
				}

				var durationMs = parseFloat(this.get('duration'))*1000,
					iterated;

				//Normal Case
				if(msec >= 0){

					this.set('delayRemain', 0);
					this.set('iterated', Math.floor(msec/durationMs));

				//if msec is negative then the animation will have delay.
				//before play (msec < delay) (Not yet played)
				}else{
					this.set('delayRemain', -1*msec);
					this.set('iterated', 0);
					msec = 0;
				}
				
				
				

				// 2.move clone
			    this.runWithDelay(clone, -1*msec);
				this.set('target', node);
			}
		},
		statics : {
			IS_SET_TIME : 1,
			IS_RESUME_TIME : 2,
			IS_DETECT_START : 3,
			IS_GET_CSS : 4,
			DETECT_START_CSS : 'detectStartCss',
			SET_TIME : 'setTime',
			eventLog : function(animate, oEvent, eventState){
				if(!animate.target){return;}
				
				var timelineState = {
					0 : 'IS_NORMAL',
					1 : 'IS_SET_TIME',
					2 : 'IS_RESUME_TIME',
					3 : 'IS_DETECT_START'
				};
				logger.event(oEvent.animationName+' -> '+oEvent.target.id +' > '+eventState+', timelineState='+timelineState[animate.timelineState]);
			},
			dispatchSetTimeEvent : function(element, selector, currentTime, animate){
				dom.dispatchEvent(element, 
					Animate.SET_TIME, {
						selector : selector,
						currentTime : currentTime,
						css : dom.getComputedStyleClone(element),
						animate : animate
					},true,true);
			},
			addAniEvent : function(){
				
				dom.addEvent(document, css.fixEvent('animationStart'), function(oEvent){

					

					var animate = Registry.getObjectById(oEvent.animationName, 'Animate');
					if(typeof animate === 'undefined'){return;}
					
					var node = animate.target;
					if(!node){return;}
					var element = node.dom.element;
					var clone = dom.byId('clone_'+element.id);
					Animate.eventLog(animate, oEvent, 'Start');

					//reset above <0. origin running state>
					if(node.visible===true){
						element.style['visibility'] = 'visible';
					}

					//setTimeWith
					if(animate.timelineState===Animate.IS_SET_TIME){

						clone.style[css.fixProp('animationPlayState')] = 'paused';
						var movedStyle = Animate.getCloneStyle(clone);

						//TODO : check wheather things changed
						var ch = dom.checkComputedStyleDiff(animate.originCss, movedStyle);
//						var ch = true;
//						if((animate.startCss.top === movedStyle.top)){
//							ch=false;
//						}
						if(animate.currentTime > 0 && ch===false){
							
						}else{

							/*
							if(animate.startCss[css.fixInline('transform')] === movedStyle[css.fixInline('transform')){
								
								
								
								
								
								
								
								
							}
							*/

							//in a delay condition then apply startCss
							if(animate.currentTime <= 0){
								animate.setStyleByDiff(element, animate.startCss);
							//apply new style to original
							}else{
								animate.setStyleByDiff(element, movedStyle);
							}
						}

						//Reset Animation
						css.resetAnimation(clone);
						animate.set('target',null);

					//IS_DETECT_START
					}else if(animate.timelineState===Animate.IS_DETECT_START){

						animate.set("startCss", Animate.getCloneStyle(clone)),
						
						
						 
						setTimeout(function(animate) {
							css.resetAnimation(animate), 
							animate.set("target", null)
						}, 1, animate), 
						animate.set("timelineState", 0), 
						dom.dispatchEvent(element, Animate.DETECT_START_CSS, {
							animate : animate,
							node : node
						}, true, true)

					//resumeTimeWith
					}else if(animate.timelineState===Animate.IS_RESUME_TIME){

						animate.set('timelineState',0);
						animate.handlers.resumeTime(animate);

					//Normal
					}else{
						animate.handlers.start(animate);
					}
				});
				dom.addEvent(document, css.fixEvent('animationIteration'), function(oEvent){
					var animate = Registry.getObjectById(oEvent.animationName, 'Animate');
					if(typeof animate === 'undefined'){return;}
					Animate.eventLog(animate, oEvent, 'Iteration');
					animate.handlers.iteration(animate);
					animate.set('iterated',animate.get('iterated')+1);
				});
				dom.addEvent(document, css.fixEvent('animationEnd'), function(oEvent){
					var animate = Registry.getObjectById(oEvent.animationName, 'Animate');
					if(typeof animate === 'undefined'){return;}
					Animate.eventLog(animate, oEvent, 'End');

					//prevent stop event when setTime() is called.
					if(animate.timelineState != Animate.IS_SET_TIME){
						animate.handlers.end(animate);
					}

					//detect end css
					//animate.detectEndCss();

					animate.set('state','stop');
					animate.set('timelineState',0);
					

					
				});
			},
			getCloneStyle : function(element){
				
				var i, prop, result={},
					styles = window.getComputedStyle(element);

				for(i=0; i<styles.length; i++){
					prop = styles[i];
					if(prop.substr(0,subLen)!==css.fixInline('animation-') && prop !== 'visibility'){
						//
						//result[prop] = styles[prop];
						result[prop] = styles.getPropertyValue(prop);
					}
				}
				//compensation
				/*
                if(typeof result['opacity']==='string'){
                    var d = Math.abs(1-parseFloat(result['opacity']));
                    //assume over 0.98 is 1
                    if(d < 0.02){
                        result['opacity'] = 1;
                    }
                }
                */
                if(typeof result[css.fixInline('transform')]==='string'){
                    if(result[css.fixInline('transform')]==='matrix(1, 0, 0, 1, 0, 0)'){
                        result[css.fixInline('transform')] = 'none';
                    }
                }
				//QT Bug
                if(env.agent==='qt'){
                	if(result['clip'] == 'rect(0px 0px 0px 0px)'){
                		result['clip'] = 'auto';
                	}
                }
				//WebKit Bug
				result['kerning'] = parseInt(result['kerning'])+'px';
				result['stroke-dashoffset'] = parseInt(result['stroke-dashoffset'])+'px';
				result['stroke-width'] = parseInt(result['stroke-width'])+'px';
				//Fix
				if(result['z-index']==='auto'){
					result['z-index'] = '0';
				}
				return result;
			}
		}
	});

	//move to start pos
	dom.addEvent(document, Animate.DETECT_START_CSS, function(oEvent){
		logger.event(Animate.DETECT_START_CSS);
		var node = oEvent.bundle.node,
			animate = oEvent.bundle.animate;
		animate.goToStartFrameWith(node);
	});

	Animate.addAniEvent();

	module.exports = Animate;
});

define('nodes/Scene',['require','exports','module','common/util','common/dom','bases/BaseObject','bases/Registry','bases/Timer','nodes/Node','actions/Animate'],function(require, exports, module) {

	var util = require('common/util'),
		dom = require('common/dom'),
		BaseObject = require('bases/BaseObject'),
		Registry = require('bases/Registry'),
		Timer = require('bases/Timer'),
		Node = require('nodes/Node'),
		Animate = require('actions/Animate');

	var Scene = util.Class({
		name : 'Scene',
		extend : Node,
		init : function(p){
			Scene.super.init.apply(this, arguments);
			this.transit = p.transit || '';
		},
		dynamics : {
			transit : null,
			addLayer : function(layer){
				this.addChild(layer);
			},
            play : function(){
                
            },
            stop : function(){
                
                /*
                TODO : for(i in this.children){
                    It's ambiguos what to stop (?)
                    layers ? shapes of layers ?
                    what about flash ? tell target stop
                }
                */
            },
            clone : function(){
            	
            	var top = '0px', left = '0px',
            		element = this.dom.element,
            		clone = dom.shadowNode(element, true),
            		zIndex = dom.getStyle(element,'zIndex'),
            		position = dom.getStyle(element,'position');

            	if(isNaN(parseInt(zIndex))){
            		zIndex = -1;
            	}else{
            		zIndex = zIndex - 1;
            	}
            	if(position=='absolute'){
					top = dom.getAbsPos(element, 'Top')+'px';
					left = dom.getAbsPos(element, 'Left')+'px';
            	}
            	dom.setStyles(clone, {
            		backgroundColor: 'red',
					position:'absolute',
					zIndex:zIndex,
					top:top,
					left:left,
            	});
            	dom.addElement(clone, element, 'after') ;
            	//element.style.opacity = 0.5;
            	/*
				dom.dispatchEvent(element, 
					Scene.CLONE_READY, {
						scene : this
					},true,true);
				*/
            }
		},
		statics : {
			CLONE_READY : 'cloneReady'
		}
	});

	module.exports = Scene;
});

define('nodes/shapes/Shape',['require','exports','module','common/util','nodes/Node'],function(require, exports, module) {

	var util = require('common/util'),
		Node = require('nodes/Node');

	var Shape = util.Class({
		name : 'Shape',
		extend : Node,
		init : function(p){
			Shape.super.init.apply(this, arguments);
		},
		dynamics : {
		},
		statics : {
		}
	});

	module.exports = Shape;
});

define('nodes/shapes/ImageShape',['require','exports','module','common/util','nodes/shapes/Shape'],function(require, exports, module) {

	var util = require('common/util'),
		Shape = require('nodes/shapes/Shape');

	var ImageShape = util.Class({
		name : 'ImageShape',
		extend : Shape,
		init : function(p){
			ImageShape.super.init.apply(this, arguments);
		},
		dynamics : {
		},
		statics : {
		}
	});
	module.exports = ImageShape;
});

define('nodes/shapes/ContainerShape',['require','exports','module','common/util','nodes/shapes/Shape'],function(require, exports, module) {

	var util = require('common/util'),
		Shape = require('nodes/shapes/Shape');
		//TODO : 순환참조(Cyclic)에 대해 조사할 것

	var ContainerShape = util.Class({
		name : 'ContainerShape',
		extend : Shape,
		init : function(p, ShapeFactory){
			ContainerShape.super.init.apply(this, arguments);
			if(p['children'] && p['children'].length){
				var i, shape,
					shapes = p['children'],
					ShapeFactory = ContainerShape.Factory;
				for(i in shapes){
					shape = ShapeFactory.create(shapes[i]);
					this.addChild(shape);
				}
			}
		},
		dynamics : {
		},
		statics : {
			Factory : null,
			create : function(p, ShapeFactory){
				this.Factory = ShapeFactory;
				return new this(p);
			}
		}
	});
	module.exports = ContainerShape;
});

define('nodes/ShapeFactory',['require','exports','module','common/util','bases/BaseObject','nodes/shapes/Shape','nodes/shapes/ImageShape','nodes/shapes/ContainerShape'],function(require, exports, module) {

	var util = require('common/util'),
		BaseObject = require('bases/BaseObject'),
		Shape = require('nodes/shapes/Shape'),
		ImageShape = require('nodes/shapes/ImageShape'),
		ContainerShape = require('nodes/shapes/ContainerShape');

	var ShapeFactory = util.Class({
		name : 'ShapeFactory',
		extend : BaseObject,
		init : function(p){
			ShapeFactory.super.init.apply(this, arguments);
		},
		dynamics : {
		},
		statics : {
			create : function(p){
				//if(p.type==='Content'){p.type='Container';} //for WUF
				if(p.hasOwnProperty('children') && p.children.length > 0){
					p.type='Container';
				}
				if(p.type && this.factories[p.type]){
					return this.factories[p.type].create(p, this);
				}else{
					return Shape.create(p);
				}
			},
			factories : {
				Image : ImageShape,
				Container : ContainerShape
			}
		}
	});

	module.exports = ShapeFactory;
});

define('nodes/Layer',['require','exports','module','common/util','nodes/Node','nodes/ShapeFactory'],function(require, exports, module) {

	var util = require('common/util'),
		Node = require('nodes/Node'),
		ShapeFactory = require('nodes/ShapeFactory');

	var Layer = util.Class({
		name : 'Layer',
		extend : Node,
		init : function(p){
			Layer.super.init.apply(this, arguments);
		},
		dynamics : {
			addShape : function(shape){
				this.addChild(shape);
			}
		},
		statics : {
		}
	});

	module.exports = Layer;
});

define('extras/AniGroup',['require','exports','module','common/util','common/logger','common/string','common/dom','common/css','dom/Dom','nodes/Scene','nodes/Layer','actions/Animate','bases/BaseObject','bases/Registry'],function(require, exports, module) {

	var util = require('common/util'),
		logger = require('common/logger'),
		string = require('common/string'),
		dom = require('common/dom'),
		css = require('common/css'),
		Dom = require('dom/Dom'),
		Scene = require('nodes/Scene'),
		Layer = require('nodes/Layer'),
		Animate = require('actions/Animate'),
		BaseObject = require('bases/BaseObject'),
		Registry = require('bases/Registry');

	var makeAniGroupAni = function(id){
		if(!dom.byId('aniplaystyle')){
			dom.makeElement('style',{id:'aniplaystyle'});
		}
		var styleSheets = document.styleSheets,
			lastSheet = styleSheets[styleSheets.length-1],
			pos = lastSheet.cssRules ? lastSheet.cssRules.length : 0;
		css.insertRule(lastSheet, '@'+css.inlinePrefix+'keyframes '+id, 'from{opacity:0} to{opacity:0.5}', pos);
	};

	var makeAniGroupElement = function(scene,id){
		return dom.makeElement('div', {
			id : id,
			style : 'visibility:hidden,width:0;height:0;'
		},{element:scene.dom.element, position:'inside'});
	};

/*
	dom.addEvent(document, Scene.CLONE_READY, function(oEvent){
		logger.event(Scene.CLONE_READY);
		var i, children;
		if(oEvent.bundle.scene){
			children = oEvent.bundle.scene.children;
			for(i in children){
				if(children[i] instanceof AniGroup){
					children[i].detectCss();
				}
			}
		}
	});
*/

	var AniGroup = util.Class({
		name : 'AniGroup',
		extend : Layer,
		init : function(p){
			AniGroup.super.init.apply(this, arguments);

			//AniGroup CSS Animation
			makeAniGroupAni(this.id);

			//AniGroup.isIDE
			
			if(AniGroup.isIDE){
				p.iteration = 1;
			}

			//AniGroup Animate
			//currently delay,direction,timing are fixed values
			this.set('action', Animate.create({
				id : this.id,
				delay: '0s',
				direction : 'normal',
				timing : 'linear',
				duration : p.duration,
				iteration : p.iteration,
				justplay : p.justplay,
				holdEnd : p.holdEnd,
				handlers : {
					start : function(animate){
						animate.target.playPairs();
						dom.dispatchEvent(animate.target.dom.element, 
							AniGroup.ANI_GROUP_START, {
								aniGroup:animate.target,
								aniGroupId:animate.target.id,
								animateId:animate.id
							},true,true);
					},
					iteration : function(animate){
						animate.target.stopPairs();
						animate.target.playPairs();
						dom.dispatchEvent(animate.target.dom.element, 
							AniGroup.ANI_GROUP_ITERATION, {
								aniGroup:animate.target,
								aniGroupId:animate.target.id,
								animateId:animate.id
							},true,true);
					},
					end : function(animate){
						
						dom.dispatchEvent(animate.target.dom.element, 
							AniGroup.ANI_GROUP_END, {
								aniGroup:animate.target,
								aniGroupId:animate.target.id,
								animateId:animate.id
							},true,true);
						setTimeout(function(animate){
							if(animate.target){
								animate.target.stop();
							}
						},50,animate);
					},
					resumeTime : function(animate){
						
						animate.target.resumeTimePairs();
					}
				}
			}));

			//members Animate
			if('members' in p && p.members.length){
				var i, targetId, action, member;
				for(i in p.members){
					member = p.members[i];
//					if(parseFloat(member.animation.duration)>0){
						targetId = member.id;
						action = Animate.create(member.animation);
						this.makePair(targetId, action);
						this.addChild(Registry.getObjectById(targetId, 'Shape'));
//					}
				}
			}
		},
		dynamics : {
			action : null,
			pairs : null,
			makePair : function(targetId, action){
				if(!this.pairs){
					this.pairs = {};
				}
				this.setAssoc('pairs', targetId, action);
			},
			addToScene : function(scene){
				scene.addChild(this);
				//AniGroup element
				makeAniGroupElement(scene, this.id);
				this.set('dom', Dom.create({id:this.id}));
			},

			repeater : null,
			currentTime : 0,
			currentTimePaused : 0,
			
			runRepeater : function(){
				
				
				
				if(this.repeater===null){
					var startMs = (new Date()).getTime();
					this.repeater = setInterval(function(that){
						var nodeId, node, animate;
						var delta = (new Date()).getTime() - startMs + that.currentTimePaused;
						//
						if(that.action.totalDuration > delta){
							that.currentTime = delta;
							//
						}else{
							that.currentTime = that.action.totalDuration;
						}
						dom.dispatchEvent(that.dom.element, 
							AniGroup.ANI_GROUP_TIME_UPDATE, {
								id : that.dom.element.id,
								currentTime : that.currentTime
							},true,true);
						//Sync currentTime
						for(nodeId in that.pairs){
							node = Registry.getObjectById(nodeId,'Node');
							animate = that.pairs[nodeId];
							if(node && animate){
								animate.set('currentTime', that.currentTime - parseFloat(animate.delay)*1000);
								//
							}
						}	
					},1,this);
				}else{
					
				}
			},
			pauseRepeater : function(currentTime){
				clearInterval(this.repeater);
				this.currentTimePaused = currentTime;
				this.repeater = null;
			},
			stopRepeater : function(){
				clearInterval(this.repeater);
				this.repeater = null;
				this.currentTime = 0;
				this.currentTimePaused = 0;
			},

			play : function(){
				var timelineState = {
					0 : 'IS_NORMAL',
					1 : 'IS_SET_TIME',
					2 : 'IS_RESUME_TIME',
					3 : 'IS_DETECT_START'
				};
				

				//Is set by Current Time
				if(this.action.timelineState===Animate.IS_SET_TIME){

					
					

					//normal
					if(this.action.currentTime < this.action.totalDuration){
						//Is set by setTime (under timeline)
						if(this.action.state == 'pause'){
							
							this.resumeTime();
						//Other Case
						}else{
							
							console.warn('other case : see here');
							return;
						}
					//overtime (stop or paused : there is a bug with webkit)
					}else{
						
						//init again then play
						this.stop();
						setTimeout(function(aniGroup){
							aniGroup.play();
						},10,this);
						return;
					}
					
				//Normal
				}else{
					//Stopped (both inside and outside of duration)
					if(this.action.state == 'stop'){
						
						this.stopRepeater();
						this.runAction(this.action);
					//Paused
					}else if(this.action.state == 'pause'){
						
						this.resume();
					//Other Case
					}else{
						
						console.warn('other case : see here');
						return;
					}
				}
				this.runRepeater();
			},
			resumeTime : function(){
				
				this.action.resumeTimeWith(this);
			},
			resumeTimePairs : function(){
				
				var nodeId, node, animate, delay, duration, msecToPlay;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.resumeTimeWith(node);
					}
				}
			},
			pause : function(){
				
				this.pausePairs();
				this.pauseAction(this.action);
				this.pauseRepeater(this.currentTime);
			},
			resume : function(){
				
				this.resumeAction(this.action);
				this.resumePairs();
			},
			stop : function(){
				
				this.stopPairs();
				this.stopAction(this.action);
				dom.dispatchEvent(this.dom.element, 
					AniGroup.ANI_GROUP_STOP, {
						aniGroup:this,
						aniGroupId:this.id,
						animateId:this.action.id
					},true,true);
				this.stopRepeater();
			},
			playPairs : function(){
				
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						node.runAction(animate);
					}
				}
			},
			pausePairs : function(){
				
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						node.pauseAction(animate);
					}
				}
			},
			resumePairs : function(){
				
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						node.resumeAction(animate);
					}
				}
			},
			stopPairs : function(){
				
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						//TODO Should I check exist then stop it?
						node.stopAction(animate);
					}
				}
			},
			goToStartFrame : function(){
				
				this.stopRepeater();
				this.action.goToStartFrameWith(this);
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.goToStartFrameWith(node);
					}
				}
			},
			resetAniGroup : function(){
				
				this.stopRepeater();
				this.action.goToStartFrameWith(this);
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.goToStartFrameWith(node);
					}
				}
			},
			setCurrentTime : function(msec){
				

				var nodeId, node, animate, delay, duration, msecToPlay, groupLooped;

				//overtime
				if(msec >= this.action.totalDuration){
					msecToPlay = this.action.totalDuration;
					
					//msecToPlay = msecToPlay;
					//this.action.set('state','stop');
				}else{
					msecToPlay = msec;
				}
				this.action.setTimeWith(this, msecToPlay);

				//groupLooped
				groupLooped = this.action.totalDuration*this.action.iterated;
				//

				//first
				if(parseFloat(msec)===0){
					this.stopRepeater();
				//last
				}else if(parseFloat(msec)===this.action.totalDuration){
					this.stopRepeater();
				//normal
				}else{
					this.pauseRepeater(msec);			
				}

				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){

						//over totalDuration
						if(msec >= this.action.totalDuration){
							msecToPlay = this.action.totalDuration - parseFloat(animate.delay)*1000;
							
							//msecToPlay = msecToPlay;
							//animate.set('state','stop');
						}else{
							delay = parseFloat(animate.delay)*1000;
							duration = parseFloat(animate.duration)*1000;
							//
							msecToPlay = msec - delay - groupLooped; //distance from start play
							//
							//
						}
						animate.setTimeWith(node, msecToPlay);
					}
				}


			},
			getCss : function(){
				
				var nodeId, node, animate, element;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						element = node.dom.element;
						//fire onSetTime event
						Animate.dispatchSetTimeEvent(
							element, 
							'#'+element.id, //TODO modify to Selector (until 1st week of Oct) 
							animate.currentTime 
						);
					}
				}
			},
			detectCss : function(){
				
				var nodeId, node, animate;
				this.action.detectStyleWith(this); //group
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.detectStyleWith(node); //node
					}
				}
			}
		},
		statics : {
			isIDE : false,
			ANI_GROUP_START : 'aniGroupStart',
			ANI_GROUP_ITERATION : 'aniGroupIteration',
			ANI_GROUP_END : 'aniGroupEnd',
			ANI_GROUP_STOP : 'aniGroupStop',
			ANI_GROUP_TIME_UPDATE : 'aniGroupTimeUpdate'
		}
	});

	module.exports = AniGroup;
});

define('nodes/Movie',['require','exports','module','common/util','common/dom','nodes/Node','extras/AniGroup'],function(require, exports, module) {

	var util = require('common/util'),
		dom = require('common/dom'),
		Node = require('nodes/Node'),
		AniGroup = require('extras/AniGroup');

	var Movie = util.Class({
		name : 'Movie',
		extend : Node,
		init : function(p){
			Movie.super.init.apply(this, arguments);
			dom.addEvent(window, 'loadScene', function(oEvent){
				oEvent.bundle.scene.play();
			});
		},
		dynamics : {
			oldScene : null,
			currentScene : null,
			addScene : function(scene){
				
				this.addChild(scene);
			},
			loadSceneById : function(sceneId){
				
				if(sceneId){
					var scene = this.getChildById(sceneId);
					this.loadScene(scene);
				}
			},
			loadScene : function(scene){
				
				this.set('oldScene',this.get('currentScene'));
				this.set('currentScene',scene);
				
				if(!dom.byId('clone_'+scene.dom.element.id)){
					scene.clone();
					setTimeout(function(that,scene){
						that.detectCss(scene);
						setTimeout(function(scene){
							dom.dispatchEvent(window, 'loadScene', {scene:scene});
						},50,scene);
					},50,this,scene);
				}else{
					this.detectCss(scene);
					setTimeout(function(scene){
						dom.dispatchEvent(window, 'loadScene', {scene:scene});
					},50,scene);
				}
			},
			detectCss : function(scene){
				
				var i, children = scene.children;
				for(i in children){
					if(children[i] instanceof AniGroup){
						children[i].detectCss();
					}
				}
			}
		},
		statics : {
		}
	});

	module.exports = Movie;
});




define('facade/MovieManager',['require','exports','module','common/util','bases/BaseObject','bases/Registry','nodes/Node','nodes/Movie','nodes/Scene','nodes/Layer','nodes/ShapeFactory','extras/AniGroup'],function(require, exports, module) {

	var util = require('common/util'),
		BaseObject = require('bases/BaseObject'),
		Registry = require('bases/Registry'),
		Node = require('nodes/Node'),
		Movie = require('nodes/Movie'),
		Scene = require('nodes/Scene'),
		Layer = require('nodes/Layer'),
		ShapeFactory = require('nodes/ShapeFactory'),
		AniGroup = require('extras/AniGroup');

	var MovieManager = util.Class({
		name : 'MovieManager',
		extend : BaseObject,
		init : function(p){
			MovieManager.super.init.apply(this, arguments);
		},
		dynamics : {
			movie : null,
			loadScenario : function(scenario){
				
				var i, j, k, g,
					scenes, layers, shapes, aniGroups,
					movie, scene, layer, shape, aniGroup;

				movie = Movie.create({id:'movie'});

				//scenes
				if('scenes' in scenario){
					scenes = scenario['scenes'];
					for(i in scenes){
						
						scene = Scene.create(scenes[i]);
						movie.addScene(scene);
						if(scenes[i].show){
							
							movie.set('currentScene',scene);
						}

						//layers
						if('layers' in scenes[i]){
							layers = scenes[i]['layers'];
							for(j in layers){
								layer = Layer.create(layers[j]);
								scene.addLayer(layer);
								//shapes
								if('shapes' in layers[j]){
									shapes = layers[j]['shapes'];
									for(k in shapes){
										shape = ShapeFactory.create(shapes[k]);
										layer.addShape(shape);
									}
								}
							}
						}

						//aniGroups
						if('aniGroups' in scenes[i]){
							aniGroups = scenes[i]['aniGroups'];
							for(g in aniGroups){
								if(!BaseObject.isEmpty(aniGroups[g])){
									aniGroup = AniGroup.create(aniGroups[g]);
									aniGroup.addToScene(scene);
								}
							}
							//addEventListeners
							//AniGroup.addAniEvent(scene);
						}

						//duplicate scene element
						//2013.12.10 for pageshow
						//scene.clone();
					}
				}
				
				this.movie = movie;
				return movie;
			},
			addWidget : function(id, containerId, animateId, angroupId, type){
				
				var container = Registry.getObjectById(containerId);
				var shape = ShapeFactory.create({
					id : id,
					type : type
				});
				container.addChild(shape);
				var aniGroup = Registry.getObjectById(angroupId, 'AniGroup');
				
				//make <Animate> instance
				//add to <Group> instance
				//TODO : this function has been canceled 2013.10.16
				//We need to make this function again on 2014 for webida. 
			}
		},
		statics : {
			singleton : null,
			create : function(){
				if(this.singleton==null){
					this.singleton = new this();
				}
				return this.singleton;
			}
		}
	});

	module.exports = MovieManager;
});

define('common/bootstrap',['require','exports','module','common/env'],function(require, exports, module) {

	var env = require('common/env');

	module.exports = {
		init : function(p){
			
			env.init(p);
		}
	};
});


define('proxy/wub/AniPlay',['require','exports','module','facade/MovieManager','common/bootstrap','common/logger','common/string','common/dom','nodes/ShapeFactory','nodes/Scene','bases/Registry','actions/Animate','extras/AniGroup'],function(require, exports, module) {

	var MovieManager = require('facade/MovieManager'),
		bootstrap = require('common/bootstrap'),
		logger = require('common/logger'),
		string = require('common/string'),
		dom = require('common/dom'),
		ShapeFactory = require('nodes/ShapeFactory'),
		Scene = require('nodes/Scene'),
		Registry = require('bases/Registry'),
		Animate = require('actions/Animate'),
		AniGroup = require('extras/AniGroup');

	var consoleStyle = 'font-size:14pt; font-weight:bold';

	/**
	Users can see this object only.
	These are set of facade functions of inner modules.
	
	@class AniPlay 
	**/
	var AniPlay = {
		movieManager : null,
		movie : null,
		logger : logger,
		dom : dom,
		string : string,
		Animate : Animate,
		ShapeFactory : ShapeFactory,
		Registry : Registry,
		log : function(){
			
		},

		init : function(){
			
			bootstrap.init({
				useJQuery : true
			});
			
			if(typeof aniPlayIsIDE != 'undefined' && aniPlayIsIDE === true){
				AniGroup.isIDE = true;
			}

			dom.addEvent(window, 'loadScene', function(oEvent){
				logger.event('loadScene : '+oEvent.bundle.scene.id);
				
				if(AniGroup.isIDE === false){
					AniPlay.playPage(oEvent.bundle.scene);
				}
			});
		},

		addWidget : function(id, containerId, animateId, angroupId, type){
			this.movieManager.addWidget(id, containerId, angroupId, type);
		},

		/**
		Update animation at runtime.
		This fire ANI_GROUP_DURATION_UPDATE event. See ANI_GROUP_DURATION_UPDATE.

		@method updateAnimation
		@example
			AniPlay.updateAnimation('anim1', 'image1', 'aniImage1', 1000, 2062.5);
		@param {String} aniGroupId aniGroup' id
		@param {String} nodeId animation's target node id
		@param {String} animateId animation's id
		@param {Float} duration duration (miliseconds)
		@param {Float} delay delay (miliseconds)
		**/
		updateAnimation : function(aniGroupId, nodeId, animateId, duration, delay){
			

			var aniGroup = Registry.getObjectById(aniGroupId, 'AniGroup');
			var node = aniGroup.getChildById(nodeId);
			
			var animate = Registry.getObjectById(animateId, 'Animate');
			
			animate.update(duration, delay);
			animate.setTimeWith(node, animate.currentTime, true);

			var i, ani, tmpLen, playLen=0;
			for(i in aniGroup.pairs){
				ani = aniGroup.pairs[i];
				tmpLen = parseFloat(ani.delay)*1000 + parseFloat(ani.duration)*1000;
				if(tmpLen > playLen){
					playLen = tmpLen;
				}
			}

			if(playLen != parseFloat(aniGroup.action.duration)*1000){
				aniGroup.action.update(playLen, 0);
				aniGroup.action.setTimeWith(aniGroup, aniGroup.action.currentTime, true);

				AniPlay.dom.dispatchEvent(
					document, 
					AniPlay.ANI_GROUP_DURATION_UPDATE, 
					{id:aniGroup.id, duration:aniGroup.action.duration},
					true, true);
			}
		},

		/**
		You should call this method when you add new Animation to a widget.
		This will detect css of start position.

		@method applyAnimation
		@example
			AniPlay.applyAnimation('image1', 'aniImage1');
		@param {String} nodeId animation's target node id
		@param {String} animateId animation's id
		**/
		applyAnimation : function(nodeId, animateId){
			
			var node = Registry.getObjectById(nodeId, 'Node');
			var animate = Registry.getObjectById(animateId, 'Animate');
			animate.detectStyleWith(node);
		},

		/**
		Loads animation model.

		@method loadPlayModel
		@example
			AniPlay.loadPlayModel(animator_cfg);
		@param {Object} config configuration object (aka model).
		**/
		loadPlayModel : function(config){
			
			//var scenario = this.convertToScenario(config);
			var scenario = config;
			var getLastChild = function(shapes){
				var lastShape = shapes[shapes.length-1];
				if(lastShape.children){
					return getLastChild(lastShape.children);
				}else{
					return lastShape;
				}
			};

			if(!scenario.scenes[0].layers[0].shapes){
				throw new Error('shapes not defined');
			}
			var shapes = scenario.scenes[0].layers[0].shapes;
			var lastChild = getLastChild(shapes);
			

			//check once
			if(document.getElementById(lastChild.id)){
				this.movieManager = MovieManager.create();
				this.movie = this.movieManager.loadScenario(scenario);
				setTimeout(function(that){

					

					//2013.12.09 bacause of pageshow
					if(AniGroup.isIDE === true){
						
						try{
							that.movie.loadScene(that.movie.currentScene);
						}catch(e){
							
						}
					}

					AniPlay.dom.dispatchEvent(
						window, 
						AniPlay.LOAD_PLAY_MODEL, {movie:this.movie},
						true, true);
				},300,this);
				
				return true;
			}else{
				console.warn(lastChild.id+' element not found');
				return false;
			}
		},

		/**
		Gets animation groups from Scene object.

		@method getAniGroups
		@example
			AniPlay.getAniGroups(scene1);
		@param {Object} scene Scene instance
		@return {Array} [AniGroups]
		**/
		getAniGroups : function(scene){
			var i, result=[];
			for(i in scene.children){
				if(scene.children[i] instanceof AniGroup){
					result.push(scene.children[i]);
				}
			}
			return result;
		},

		/**
		Gets animation groups from Scene object by state.

		@method getGroupsByState
		@example
			AniPlay.getGroupsByState(scene1);
		@param {Object} scene Scene instance
		@param {String} state 'run' | 'pause' | 'stop'
		@return {Array} [AniGroups]
		**/
		getGroupsByState : function(scene, state){
			var i, result=[],
				aniGroups=this.getAniGroups(scene);
			for(i in aniGroups){
				
				
				
				if(aniGroups[i].action.state===state){
					result.push(aniGroups[i]);
				}
			}
			return result;
		},

		/**
		Gets animation groups from Registry by id(s).

		@method getGroupsById
		@example
			AniPlay.getGroupsById('Anim1');
			AniPlay.getGroupsById(['Anim1','Anim2']);
		@param {Mixed} ids
		@return {Array} [AniGroups]
		**/
		getGroupsById : function(ids){
			var i, result=[], aniGroup;
			if(typeof ids ==='string'){
				ids = [ids];
			}
			for(i in ids){
				aniGroup = Registry.getObjectById(ids[i],'AniGroup');
				if(aniGroup){
					result.push(aniGroup);
				}
			}
			return result;
		},

		/**
		Gets animation groups to be play automatically.

		@method getJustPlayGroups
		@example
			AniPlay.getJustPlayGroups(scene1);
		@param {Object} scene Scene instance
		@return {Array} [AniGroups]
		**/
		getJustPlayGroups : function(scene){
			var i, result=[],
				aniGroups=this.getAniGroups(scene);
			for(i in aniGroups){
				if(aniGroups[i].action.justplay===true){
					result.push(aniGroups[i]);
				}
			}
			return result;
		},

		/**
		Gets current active page.

		@method getCurrentPage
		@example
			AniPlay.getCurrentPage();
		@return {Object} scene Scene instance
		**/
		getCurrentPage : function(){
			
			return this.movie.get('currentScene');
		},

		/**
		Plays all animation groups of current active page.

		@method playCurrentPage
		@example
			AniPlay.playCurrentPage();
		**/
		playCurrentPage : function(){
			
			this.playPage(this.movie.get('currentScene'));
		},

		/**
		Plays animation groups of page by Scene object (autoPlay true case only).

		@method playPage
		@example
			AniPlay.playPage(scene1);
		@param {Object} scene Scene instance
		**/
		playPage : function(scene){
			
			this.playAniGroups(scene, this.getJustPlayGroups(scene));
		},

		/**
		Plays all animation groups of page by pageId

		@method playPageById
		@example
			AniPlay.playPageById('page1');
		@param {String} pageId page's id.
		**/
		playPageById : function(pageId){
			
			this.playPage(Registry.getObjectById(pageId,'Scene'));
		},

		/**
		Plays all animation groups of page by Scene object.

		@method playAllAniGroups
		@example
			AniPlay.playAllAniGroups(scene1);
		@param {Object} scene Scene instance
		**/
		playAllAniGroups : function(scene){
			
			this.playAniGroups(scene, this.getAniGroups(scene));
		},

		/**
		Plays animation groups on a page.

		@method playAniGroups
		@example
			AniPlay.playAniGroups(scene1, [aniGroup1, aniGroup2]);
		@param {Object} scene Scene instance.
		@param {Array} aniGroups Array of AniGroup instances.
		**/
		playAniGroups : function(scene, aniGroups){
			
			
			var i,
				check = {stop:0,pause:0,run:0};
			for(i in aniGroups){
				check[aniGroups[i].action.state]++;
			}
			//nothing run
			if(check['run']===0){
				//if all stopped or paused
				if(check['pause']===0 || check['stop']===0){
					for(i in aniGroups){
						aniGroups[i].play();
					}
				//if some groups are stopped,
				//run `paused groups` only
				}else{
					for(i in aniGroups){
						if(aniGroups[i].action.state==='pause'){
							
							aniGroups[i].play();
						}
					}
				}
			}
		},

		/**
		Plays animation groups on a page.

		@method playAniGroupsById
		@example
			AniPlay.playAniGroupsById('page1', 'Anim1');
			AniPlay.playAniGroupsById('page1', ['Anim1', 'Anim2']);
		@param {String} pageId page's id.
		@param {Mixed} aniGroupIds The animation groups' ids.
		**/
		playAniGroupsById : function(pageId, aniGroupIds){
			
			var scene = Registry.getObjectById(pageId,'Scene');
			var aniGroups = this.getGroupsById(aniGroupIds);
			this.playAniGroups(scene, aniGroups);
		},

		/**
		Pauses current page's all animation group(s).

		@method pauseCurrentPage
		@example
			AniPlay.pauseCurrentPage();
		**/
		pauseCurrentPage : function(){
			
			this.pausePage(this.movie.get('currentScene'));
		},

		/**
		Pauses running animation group(s) of a page.

		@method pausePage
		@example
			AniPlay.pausePage(scene1);
		@param {Object} scene Scene instance
		**/
		pausePage : function(scene){
			
			this.pauseAniGroups(scene, this.getGroupsByState(scene,'run'));
		},

		/**
		Pauses running animation group(s) of a page by pageId.

		@method pausePageById
		@example
			AniPlay.pausePageById('page1');
		@param {String} pageId page's id.
		**/
		pausePageById : function(pageId){
			
			this.pausePage(Registry.getObjectById(pageId,'Scene'));
		},

		/**
		Pauses animation group(s) on a page.

		@method pauseAniGroups
		@example
			AniPlay.pauseAniGroups(scene1, [aniGroup1, aniGroup2]);
		@param {Object} scene Scene instance.
		@param {Array} aniGroups Array of AniGroup instances.
		**/
		pauseAniGroups : function(scene, aniGroups){
			var aniGroupIds=[];
			for(var i in aniGroups){
				aniGroupIds.push(aniGroups[i].id);
			}
			
			var i;
			for(i in aniGroups){
				aniGroups[i].pause();
			}
		},

		/**
		Pauses animation group(s) on a page by Ids.

		@method pauseAniGroupsById
		@example
			AniPlay.pauseAniGroupsById('page1', 'Anim1');
			AniPlay.pauseAniGroupsById('page1', ['Anim1', 'Anim2']);
		@param {String} pageId page's id.
		@param {Mixed} aniGroupIds The animation groups' ids.
		**/
		pauseAniGroupsById : function(pageId, aniGroupIds){
			
			var scene = Registry.getObjectById(pageId,'Scene');
			var aniGroups = this.getGroupsById(aniGroupIds);
			this.pauseAniGroups(scene, aniGroups);
		},

		/**
		Stops current page's all animation group(s).

		@method stopCurrentPage
		@example
			AniPlay.stopCurrentPage();
		**/
		stopCurrentPage : function(){
			
			this.stopPage(this.movie.get('currentScene'));
		},

		/**
		Stops all the animation group(s) of a page.

		@method stopPage
		@example
			AniPlay.stopPage(scene1);
		@param {Object} scene Scene instance
		**/
		stopPage : function(scene){
			
			this.stopAniGroups(scene, this.getAniGroups(scene));
		},

		/**
		Stops all the animation group(s) of a page by pageId.

		@method stopPageById
		@example
			AniPlay.stopPageById('page1');
		@param {String} pageId page's id.
		**/
		stopPageById : function(pageId){
			
			this.stopPage(Registry.getObjectById(pageId,'Scene'));
		},

		/**
		Stops animation group(s) on a page.

		@method stopAniGroups
		@example
			AniPlay.stopAniGroups(scene1, [aniGroup1, aniGroup2]);
		@param {Object} scene Scene instance.
		@param {Array} aniGroups Array of AniGroup instances.
		**/
		stopAniGroups : function(scene, aniGroups){
			
			var i;
			for(i in aniGroups){
				aniGroups[i].stop();
			}
		},

		/**
		Stops animation group(s) on a page by ids.

		@method stopAniGroupsById
		@example
			AniPlay.stopAniGroupsById('page1', 'Anim1');
			AniPlay.stopAniGroupsById('page1', ['Anim1', 'Anim2']);
		@param {String} pageId page's id.
		@param {Mixed} aniGroupIds The animation groups' ids.
		**/
		stopAniGroupsById : function(pageId, aniGroupIds){
			
			var scene = Registry.getObjectById(pageId,'Scene');
			var aniGroups = this.getGroupsById(aniGroupIds);
			this.stopAniGroups(scene, aniGroups);
		},

		/**
		Go to first frame of (a) aniGroup(s) in the current page(Scene).
		This will dispatch AniPlay.SET_TIME ('setTime') event to the elements of the group.

		@method goToStartFrame
		@example
			AniPlay.goToStartFrame('Anim1');
			AniPlay.goToStartFrame(['Anim1', 'Anim2']);
		@param {Mixed} [groupIds]  The animation group id(s).
		**/
		goToStartFrame : function(groupIds){
			
			var aniGroups, i;
			if(groupIds){
				if(typeof groupIds ==='string'){groupIds=[groupIds];}
				aniGroups = this.getGroupsById(groupIds);
			}else{
				aniGroups = this.getAniGroups(this.movie.get('currentScene'));
			}
			for(i in aniGroups){
				aniGroups[i].goToStartFrame();
			}
		},

		/**
		Moves animations to a specific time. If you omit groupId, all AniGroups will be moved.

		@method setCurrentTime
		@example
			AniPlay.setCurrentTime(2500);
			AniPlay.setCurrentTime(2500, 'Anim1');
			AniPlay.setCurrentTime(2500, ['Anim1','Anim2']);
		@param {Integer} msec  The milisecond time to move.
		@param {Mixed} [groupIds]  The animation group id(s).
		@return {Object} CSS Properties of the contained widgets.
		**/
		setCurrentTime : function(msec, groupIds){
			
			var aniGroups, i;
			if(groupIds){
				if(typeof groupIds ==='string'){groupIds=[groupIds];}
				aniGroups = this.getGroupsById(groupIds);
			}else{
				aniGroups = this.getAniGroups(this.movie.get('currentScene'));
			}
			for(i in aniGroups){
				aniGroups[i].setCurrentTime(msec);
			}
		},

		/**
		Get css from animation group

		@method getCssByGroupId
		@example
			AniPlay.getCssByGroupId('Anim1');
			AniPlay.getCssByGroupId(['Anim1','Anim2']);
		@param {Mixed} [groupIds]  The animation group id(s).
		@return {Object} CSS Properties of the contained widgets by setTime event.
		**/
		getCssByGroupId : function(groupIds){
			
			var aniGroups, i;
			if(groupIds){
				if(typeof groupIds ==='string'){groupIds=[groupIds];}
				aniGroups = this.getGroupsById(groupIds);
			}else{
				aniGroups = this.getAniGroups(this.movie.get('currentScene'));
			}
			for(i in aniGroups){
				aniGroups[i].getCss();
			}
		},

		/**
		Sets widget element's visibility

		@method setVisible
		@example
			AniPlay.setVisible('image1', true);
		@param {String} nodeId  animation's target node id
		@param {Boolean} isVisible  true to visible, false to hidden
		**/
		setVisible : function(nodeId, isVisible){
			
			var node = Registry.getObjectById(nodeId, 'Node');
			node.set('visible', isVisible);
			
		},

		/**
		When an aniGroup start, this event will be fired on an animation group element(invisible).
		
		@event ANI_GROUP_START
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupStart'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_START, function(oEvent){
		**/
		ANI_GROUP_START : AniGroup.ANI_GROUP_START,

		/**
		When an aniGroup iteration start, this event will be fired on an animation group element(invisible).
		
		@event ANI_GROUP_ITERATION
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupIteration'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_ITERATION, function(oEvent){
		**/
		ANI_GROUP_ITERATION : AniGroup.ANI_GROUP_ITERATION,

		/**
		When an aniGroup end, this event will be fired on an animation group element(invisible).
		
		@event ANI_GROUP_END
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupEnd'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_END, function(oEvent){
		**/
		ANI_GROUP_END : AniGroup.ANI_GROUP_END,

		/**
		The stop event is called when aniGroup's animation ended or an user stops aniGroup's animation.
		This event would be dispatched after AniPlay.ANI_GROUP_END event.

		@event ANI_GROUP_STOP
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupStop'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_STOP, function(oEvent){
		**/
		ANI_GROUP_STOP : AniGroup.ANI_GROUP_STOP,

		/**
		Called when all the aniGroup's animation has been ended.

		@event ALL_ANI_GROUP_STOP
		@bubbles true
		@value {String} 'allAniGroupStop'
		@example
			document.addEventListener(AniPlay.ALL_ANI_GROUP_STOP, function(oEvent){
		**/
		ALL_ANI_GROUP_STOP : 'allAniGroupStop',

		/**
		Called when AniGroup instance's setCurrentTime() method is called.
		Event Object has a bundle object that contains selector name, css collection of the element
		and currentTime of the Animate Class instance. See examples.

		@event SET_TIME
		@bubbles true
		@value {String} 'setTime'
		@example
			document.addEventListener(AniPlay.SET_TIME, function(oEvent){
			document.addEventListener(
				AniPlay.SET_TIME, function(oEvent){
					
			});
		**/
		SET_TIME : 'setTime',

		/**
		Called when an aniGroup is playing

		@event ANI_GROUP_TIME_UPDATE
		@bubbles true
		@value {String} 'aniGroupTimeUpdate'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_TIME_UPDATE, function(oEvent){
				
				//{id: "anim2", currentTime: 5379} 
			});
		**/
		ANI_GROUP_TIME_UPDATE : AniGroup.ANI_GROUP_TIME_UPDATE,

		/**
		Called when an aniGroup duration changed by sub animation.

		@event ANI_GROUP_DURATION_UPDATE
		@bubbles true
		@value {String} 'aniGroupDurationUpdate'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_DURATION_UPDATE, function(oEvent){
				
				//{id:'aniGroup1', duration: 2100} 
			});
		**/
		ANI_GROUP_DURATION_UPDATE : 'aniGroupDurationUpdate',

		/**
		Called when the AniPlay Framework is ready to use.
		You must use String 'aniPlayReady' rather than constant AniPlay.ANI_PLAY_READY
		because of AMD issue (Require.js loads modules asynchronously).

		@event ANI_PLAY_READY
		@bubbles true
		@value {String} 'aniPlayReady'
		@example
			window.addEventListener('aniPlayReady', function(oEvent){
		**/
		ANI_PLAY_READY : 'aniPlayReady',

		/**
		Called when the new animation config loaded.

		@event LOAD_PLAY_MODEL
		@bubbles true
		@value {String} 'loadPlayModel'
		@example
			window.addEventListener(AniPlay.LOAD_PLAY_MODEL, function(oEvent){
				
				//{movie: Movie Node Object} 
			});
		**/
		LOAD_PLAY_MODEL : 'loadPlayModel'
	};

	AniPlay.dom.addEvent(document, AniPlay.ANI_GROUP_START, function(oEvent){
		
	});

	AniPlay.dom.addEvent(document, AniPlay.ANI_GROUP_STOP, function(oEvent){
		logger.event(AniPlay.ANI_GROUP_STOP);
		var scene = oEvent.bundle.aniGroup.parent,
			aniGroups = AniPlay.getAniGroups(scene),
			stopGroups = AniPlay.getGroupsByState(scene,'stop');
			//
			setTimeout(function(scene){
				if(aniGroups.length==stopGroups.length){
					AniPlay.dom.dispatchEvent(
						scene.dom.element, 
						AniPlay.ALL_ANI_GROUP_STOP, {},
						true, true);
				}
			},1,scene);
	});

	module.exports = AniPlay;
});

requirejs.config({
	//By default load any module IDs from
	baseUrl : 'aniplay/libs',
	//except, if the module ID starts with "app",
	//load it from the js/app directory. paths
	//config is relative to the baseUrl, and
	//never includes a ".js" extension since
	//the paths config could be for a directory.
	paths : {
		app : '../app',
		proxy : '../proxy'
	}//,
	//urlArgs : "bust="+(new Date()).getTime()
});

var AniPlay;

(function() {

	require(
		['proxy/wub/AniPlay'],
		function(_AniPlay){

			if(typeof ComingBridge!='undefined' && 
				typeof ComingBridge.printLog =='function' &&
				typeof console == 'object'){
				
				console.warn = ComingBridge.printLog;
			}

			AniPlay = _AniPlay;
			AniPlay.dom.dispatchEvent(window, 
				AniPlay.ANI_PLAY_READY, AniPlay, true, true);
			AniPlay.init();

			if(typeof animator_cfg === 'object'){

				//AniPlay.loadPlayModel(animator_cfg);
				//AniPlay.dom.addEvent(window, 'wubReady', function(){
				//	AniPlay.loadPlayModel(animator_cfg);
				//});

				if(typeof aniPlayIsIDE === 'undefined' || aniPlayIsIDE === false){
					var checkDom=null, checkDomCount=0;
					(function(){
						checkDom = setInterval(function(){
							if(AniPlay.loadPlayModel(animator_cfg)){
								clearInterval(checkDom);
								checkDom = null;
							}
							if(checkDom && checkDomCount > 20){
								clearInterval(checkDom);
								checkDom = null;
								console.warn('AniPlay.loadPlayModel(animator_cfg) failed');
							}
							checkDomCount++;
						},100);
						//for safe
						setTimeout(function(){
							clearInterval(checkDom);
							checkDom = null;
						}, 3000);
					})();
				}
			}

			/*
			document.addEventListener(
				AniPlay.ANI_GROUP_END, function(oEvent){
				
			});
			document.addEventListener(
				AniPlay.ANI_GROUP_ITERATION, function(oEvent){
				
			});
			document.addEventListener(
				AniPlay.ANI_GROUP_START, function(oEvent){
				
			});

			document.addEventListener(
				AniPlay.ALL_ANI_GROUP_STOP, function(oEvent){
					
			});

			AniPlay.dom.addEvent(document, 'keydown', function(oEvent){
				if(oEvent.keyCode==49){
					AniPlay.playCurrentPage();
				}else if(oEvent.keyCode==50){
					AniPlay.pauseCurrentPage();
				}else if(oEvent.keyCode==51){
					AniPlay.stopCurrentPage();

				}else if(oEvent.keyCode==52){
					AniPlay.playPageById('page1');
				}else if(oEvent.keyCode==53){
					AniPlay.pausePageById('page1');
				}else if(oEvent.keyCode==54){
					AniPlay.stopPageById('page1');

				}else if(oEvent.keyCode==55){
					AniPlay.playAniGroupsById('page1', ['anim1']);
				}else if(oEvent.keyCode==56){
					AniPlay.pauseAniGroupsById('page1', 'anim1');
				}else if(oEvent.keyCode==57){
					AniPlay.stopAniGroupsById('page1', ['anim2']);
					
				}else if(oEvent.keyCode==48){
					AniPlay.goToStartFrame();
				}
			});
			*/
		}
	);

})();
define("app/main.wub", function(){});
