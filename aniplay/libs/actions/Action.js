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