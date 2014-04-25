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

	var string = require('common/string');

	var css = {
		propPrefix : 'webkit',
		eventPrefix : 'webkit',
		inlinePrefix : '-webkit-',
		detectPrexfix : function(){
			console.log('css.detectPrexfix()');
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
			console.log('this.propPrefix = '+this.propPrefix);
			console.log('this.inlinePrefix = '+this.inlinePrefix);
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
			console.log('css.insertRule(styleSheet,'+selector+','+cssDesc+',pos)');
			if(styleSheet.insertRule){
				styleSheet.insertRule(selector+'{'+cssDesc+'}',pos);
			}else if(styleSheet.addRule){
				styleSheet.addRule(selector,cssDesc,pos);
			}else{
				throw new Error('insertRule() not supported');
			}
		},
		setAnimation : function(element, prop){
			console.log('css.setAnimation('+element.id+',prop)');
			element.style[this.fixProp('animationName')] = prop.name;
			element.style[this.fixProp('animationDelay')] = prop.delay;
			element.style[this.fixProp('animationFillMode')] = prop.fillmode;
			element.style[this.fixProp('animationDuration')] = prop.duration;
			element.style[this.fixProp('animationDirection')] = prop.direction;
			element.style[this.fixProp('animationTimingFunction')] = prop.timing;
			element.style[this.fixProp('animationIterationCount')] = prop.iteration;
			element.style[this.fixProp('animationPlayState')] = 'running';
			
			//console.log(element.style[this.fixProp('animationName')]);
		},
		resetAnimation1 : function(element){
			console.log('css.resetAnimation('+element.id+')');
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
				console.log(e.message);
			}
		},
		resetAnimation : function(element){
			console.log('css.resetAnimation('+element.id+')');
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
				console.log(e.message);
			}
		}
	};

	css.detectPrexfix();

	module.exports = css;

});
