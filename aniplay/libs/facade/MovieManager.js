/****************************************************************************
 Copyright (c) 2014 Peter, H

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

"use strict";
define(function(require, exports, module) {

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
				console.log(scenario);
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
							console.log("movie.set('currentScene',"+scene.id+")");
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
				console.log('\r\n',movie,'\r\n');
				this.movie = movie;
				return movie;
			},
			addWidget : function(id, containerId, animateId, angroupId, type){
				console.log('<MovieManager> movieManager.addWidget(id, containerId, animateId, angroupId, type)');
				var container = Registry.getObjectById(containerId);
				var shape = ShapeFactory.create({
					id : id,
					type : type
				});
				container.addChild(shape);
				var aniGroup = Registry.getObjectById(angroupId, 'AniGroup');
				console.log(aniGroup);
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