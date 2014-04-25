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