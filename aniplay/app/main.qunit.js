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

requirejs.config({

	//By default load any module IDs from js/lib
	baseUrl : 'aniplay/libs',

	//except, if the module ID starts with "app",
	//load it from the js/app directory. paths
	//config is relative to the baseUrl, and
	//never includes a ".js" extension since
	//the paths config could be for a directory.
	paths : {
        app : '../app',
        proxy : '../proxy'
	},

	urlArgs : "bust="+(new Date()).getTime()
});

(function() {

	var ANI_PLAY_BUILD_LABEL = '1.0-20130723';

	(function() {

		require(
            [
              'bases/Registry', 
              'nodes/Node', 
              'common/array'
            ], 
            function(
                Registry, 
                Node,
                array
            ){

            // Node
            test("Node", function() {
                
                var node1 = Node.create({id:'node1'});
                var node2 = Node.create({id:'node2'});
                var node3 = Node.create({id:'node3'});
                node1.addChild(node2);
                node1.set('parent', node3);

                console.log(node1);
                console.log(node2);
                console.log(node3);

                ok(node1, 'node1 exist');
                ok(node1.hasParent(), 'node1.hasParent()');
                strictEqual(node3, node1.get('parent'), "node3 === node1.get('parent')");
                ok(array.inArray(node1.get('children'), node2), 'node2 found in node1\'s children');
                ok(node2.hasParent(), 'node2.hasParent()');
            });

            // Registry
            test("Registry", function() {
                
                var node1 = Node.create({id:'node1'});
                ok(Registry.getObjectById('node1') instanceof Node, "Registry.getObjectById('node1') instanceof Node");

                strictEqual(node1, Registry.getObjectById('node1'), "node1 === Registry.getObjectById('node1')");
            });

		});

	})();

})();