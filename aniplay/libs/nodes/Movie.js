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
				console.log('<Movie> '+this.id+'.addScene('+scene.id+')');
				this.addChild(scene);
			},
			loadSceneById : function(sceneId){
				console.log('<Movie> '+this.id+'.loadSceneById('+sceneId+')');
				if(sceneId){
					var scene = this.getChildById(sceneId);
					this.loadScene(scene);
				}
			},
			loadScene : function(scene){
				console.log('<Movie> '+this.id+'.loadScene('+scene.id+')');
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
				console.log('<Movie> '+this.id+'.detectCss('+scene.id+')');
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


