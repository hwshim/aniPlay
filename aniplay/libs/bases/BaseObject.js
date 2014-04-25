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