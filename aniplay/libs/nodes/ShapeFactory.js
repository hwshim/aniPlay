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