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
                console.log('<Scene> '+this.id+'.play()');
            },
            stop : function(){
                console.log('<Scene> '+this.id+'.stop()');
                /*
                TODO : for(i in this.children){
                    It's ambiguos what to stop (?)
                    layers ? shapes of layers ?
                    what about flash ? tell target stop
                }
                */
            },
            clone : function(){
            	console.log('<Scene> '+this.id+'.clone()');
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