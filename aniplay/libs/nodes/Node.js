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