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

	module.exports = {
		byId : function(id){
			return document.getElementById(id);
		},
		byTag : function(tagName){
			return document.getElementsByTagName(tagName);
		},
		bySelector : function(selector, element){
			element = element || document;
			return element.querySelectorAll(selector);
		},
		getAppliedStyleClone : function(element){
			var prop, result=new Object();
			for(prop in element.style){
				result[prop] = element.style[prop];
			}
			return result;
		},
		getComputedStyleClone : function(element){
			var styles = window.getComputedStyle(element),
				len = styles.length, i, prop,
				result = {};
			for(i=0; i<len; i++){
				prop = styles[i];
				//result[prop] = styles[prop];
				result[prop] = styles.getPropertyValue(prop);
			}
			return result;
		},
		getComputedStyleDiff : function(styleOrg, styleVar){
			var prop, result={};
			for(prop in styleOrg){
				if(styleOrg[prop]!=styleVar[prop]){
					result[prop] = styleVar[prop];
				}
			}
			return result;
		},
		checkComputedStyleDiff : function(styleOrg, styleVar){
			var i, check=false, result = this.getComputedStyleDiff(styleOrg, styleVar);
			for(i in result){
				//console.log(i+' = '+result[i]);
				check=true;
			}
			return check;
		},
		getStyle : function(element, prop){
			var styles = window.getComputedStyle(element);
			//return styles[prop];
			return styles.getPropertyValue(prop);
		},
		setStyles : function(element, propSet){
			//console.log('dom.setStyles('+element.id+', propSet)');
			var prop, style=element.style;
			for(prop in propSet){
				style.setProperty(prop, propSet[prop]);
			}
		},
		makeElement : function(tag, properties, where, win){
			if(typeof win=='undefined') {win = window;}
			var element = win.document.createElement(tag);
			win.document.body.appendChild(element) ;
			if(properties){
				for (var p in properties) {
					element[p] = properties[p] ;
				}
			}
			if(where){
				this.addElement(element, where.element, where.position) ;
			}else{
				win.document.body.appendChild(element) ;
			}
			return element;
		},
		/**
		 * @param {element} newElement
		 * @param {element} where
		 * @param {String} pos : 'before', 'after', 'inside'
		 */
		addElement : function(newElement, where, pos){
			if(pos=='after' || pos==undefined){
				where.parentNode.insertBefore(newElement, where.nextSibling) ;
			}else if(pos=='before'){
				where.parentNode.insertBefore(newElement, where) ;
			}else if(pos=='inside'){
				where.appendChild(newElement);
				//where.insertBefore(newElement, where.lastChild) ;
			}
		},
		nodeType : {
			1 : 'ELEMENT_NODE',
			2 : 'ATTRIBUTE_NODE',
			3 : 'TEXT_NODE',
			4 : 'CDATA_SECTION_NODE',
			5 : 'ENTITY_REFERENCE_NODE',
			6 : 'ENTITY_NODE',
			7 : 'PROCESSING_INSTRUCTION_NODE',
			8 : 'COMMENT_NODE',
			9 : 'DOCUMENT_NODE',
			10 : 'DOCUMENT_TYPE_NODE',
			11 : 'DOCUMENT_FRAGMENT_NODE',	
			12 : 'NOTATION_NODE'
		},
		prepareNode : function(){
			if(typeof window.Node === 'undefined'){
				for(i in this.nodeType){
					window.Node[this.nodeType[i]] = i;
				}
			}
		},
		cloneNode : function(element, isRecursive){
			var clone;
			switch(element.nodeType){
				//Now we just copy ELEMENT, TEXT NODE
				case Node.ELEMENT_NODE :
					//refer to element.attributes
					//Now we just copy id and class to clone
					//If you need more add it then.
					clone = document.createElement(element.nodeName);
					clone.id = element.id;
					clone.className = element.className;
					this.setStyles(clone, this.getComputedStyleClone(element));
					break;
				case Node.TEXT_NODE :
					clone = document.createTextNode(element.nodeValue);
					//if(string.trim(clone.nodeValue)){clone.nodeValue = 'c_'+clone.nodeValue;}
					break;
				default :
			}
			return clone;
		},
		shadowNode : function(element, isRecursive){
			this.prepareNode();
			//var clone = element.cloneNode(false);
			var clone = this.cloneNode(element, false);
			//var clone;
			switch(element.nodeType){
				case Node.ELEMENT_NODE :
//					console.log('ELEMENT_NODE : '+element.nodeName+' : '+element.id);
					this.setStyles(clone, {visibility: 'hidden'});
					if(clone.id){clone.id = 'clone_'+clone.id;} //TODO : selector case
					if(element.hasChildNodes()){
						var child;
						for(child=element.firstChild; child != null; child = child.nextSibling){
							clone.appendChild(this.shadowNode(child, isRecursive));
						}
					}
					break;
				case Node.TEXT_NODE :
//					console.log('TEXT_NODE : '+element.nodeValue);
					break;
				default :
					console.log('default');
			}
			return clone;
		},
		cloneElement : function(element, position){
			console.log('cloneElement('+element.id+')');
			var i, childNode, nodeType;
			var properties = {id:'clone_'+element.id};
			var newElement = this.makeElement(element.nodeName, properties, {
				element:element, position:position || 'after'
			});
			newElement.innerHTML = properties.id;
			return newElement;
		},
		addEvent : function(element, eventName, eventHandler){ 
			if(element.addEventListener){
				element.addEventListener(eventName, eventHandler, false);
			}else{
				element.attachEvent('on'+eventName, eventHandler);
			}
			return eventHandler;
		},
		removeEvent : function(element, eventName, eventHandler){
			if(element.addEventListener){
				element.removeEventListener(eventName, eventHandler, false);
			}else{
				element.detachEvent('on'+eventName, eventHandler);
			}
		},
		createEvent : function(eventName, data, bubbles, cancelable, noBundle) {
			var oEvent = document.createEvent('Events');
			oEvent.initEvent(eventName, bubbles, cancelable);
			if(!noBundle){oEvent.bundle = {};}
			if(data){
				for(var i in data) {
					if(data.hasOwnProperty(i)){
						if(noBundle){
							oEvent[i] = data[i];
						}else{
							oEvent.bundle[i] = data[i];
						}
					}
				}
			}
			return oEvent;
		},
		dispatchEvent : function(element, eventName, data, bubbles, cancelable, noBundle){
			var id = element.id ? ':'+element.id : '';
			if(eventName != 'aniGroupTimeUpdate'){
				console.log('%c\r\n   <==== dispatchEvent('+element.toString().replace('object ','')+id+', \''+eventName+'\')', 'color:orange');
			}
			if(element.fireEvent){
				element.fireEvent('on'+eventName);
				//TODO bundle
			}else if(element.dispatchEvent){
				element.dispatchEvent(this.createEvent(eventName, data, bubbles, cancelable, noBundle));
			}
		},
		hide : function(id){
			var element = this.byId(id);
			if(element){
				element.style.display = 'none';
			}
		},
		/**
		 * @param {element} element
		 * @param {String} pos : 'Left', 'Top'
		 */
		getAbsPos : function(element, pos){
			var result = 0;
			while(element.offsetParent){
				result += element['offset'+pos];
				element = element.offsetParent;
			}
			return result;
		}
	};

});
