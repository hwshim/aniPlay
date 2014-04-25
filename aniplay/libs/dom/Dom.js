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
				//console.log('-----> events',p.events);
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