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

	var MovieManager = require('facade/MovieManager'),
		bootstrap = require('common/bootstrap'),
		logger = require('common/logger'),
		string = require('common/string'),
		dom = require('common/dom'),
		ShapeFactory = require('nodes/ShapeFactory'),
		Scene = require('nodes/Scene'),
		Registry = require('bases/Registry'),
		Animate = require('actions/Animate'),
		AniGroup = require('extras/AniGroup');

	var consoleStyle = 'font-size:14pt; font-weight:bold';

	/**
	Users can see this object only.
	These are set of facade functions of inner modules.
	
	@class AniPlay 
	**/
	var AniPlay = {
		movieManager : null,
		movie : null,
		logger : logger,
		dom : dom,
		string : string,
		Animate : Animate,
		ShapeFactory : ShapeFactory,
		Registry : Registry,
		log : function(){
			console.log.apply(console,arguments);
		},

		init : function(){
			console.log('%cAniPlay.init()', consoleStyle);
			bootstrap.init({
				useJQuery : true
			});
			
			if(typeof aniPlayIsIDE != 'undefined' && aniPlayIsIDE === true){
				AniGroup.isIDE = true;
			}

			dom.addEvent(window, 'loadScene', function(oEvent){
				logger.event('loadScene : '+oEvent.bundle.scene.id);
				console.log('AniGroup.isIDE = '+AniGroup.isIDE);
				if(AniGroup.isIDE === false){
					AniPlay.playPage(oEvent.bundle.scene);
				}
			});
		},

		addWidget : function(id, containerId, animateId, angroupId, type){
			this.movieManager.addWidget(id, containerId, angroupId, type);
		},

		/**
		Update animation at runtime.
		This fire ANI_GROUP_DURATION_UPDATE event. See ANI_GROUP_DURATION_UPDATE.

		@method updateAnimation
		@example
			AniPlay.updateAnimation('anim1', 'image1', 'aniImage1', 1000, 2062.5);
		@param {String} aniGroupId aniGroup' id
		@param {String} nodeId animation's target node id
		@param {String} animateId animation's id
		@param {Float} duration duration (miliseconds)
		@param {Float} delay delay (miliseconds)
		**/
		updateAnimation : function(aniGroupId, nodeId, animateId, duration, delay){
			console.log('%cAniPlay.updateAnimation('+aniGroupId+', '+nodeId+', '+animateId+', '+duration+', '+delay+')', consoleStyle);

			var aniGroup = Registry.getObjectById(aniGroupId, 'AniGroup');
			var node = aniGroup.getChildById(nodeId);
			console.log(node);
			var animate = Registry.getObjectById(animateId, 'Animate');
			
			animate.update(duration, delay);
			animate.setTimeWith(node, animate.currentTime, true);

			var i, ani, tmpLen, playLen=0;
			for(i in aniGroup.pairs){
				ani = aniGroup.pairs[i];
				tmpLen = parseFloat(ani.delay)*1000 + parseFloat(ani.duration)*1000;
				if(tmpLen > playLen){
					playLen = tmpLen;
				}
			}

			if(playLen != parseFloat(aniGroup.action.duration)*1000){
				aniGroup.action.update(playLen, 0);
				aniGroup.action.setTimeWith(aniGroup, aniGroup.action.currentTime, true);

				AniPlay.dom.dispatchEvent(
					document, 
					AniPlay.ANI_GROUP_DURATION_UPDATE, 
					{id:aniGroup.id, duration:aniGroup.action.duration},
					true, true);
			}
		},

		/**
		You should call this method when you add new Animation to a widget.
		This will detect css of start position.

		@method applyAnimation
		@example
			AniPlay.applyAnimation('image1', 'aniImage1');
		@param {String} nodeId animation's target node id
		@param {String} animateId animation's id
		**/
		applyAnimation : function(nodeId, animateId){
			console.log('%cAniPlay.applyAnimation('+nodeId+', '+animateId+')', consoleStyle);
			var node = Registry.getObjectById(nodeId, 'Node');
			var animate = Registry.getObjectById(animateId, 'Animate');
			animate.detectStyleWith(node);
		},

		/**
		Loads animation model.

		@method loadPlayModel
		@example
			AniPlay.loadPlayModel(animator_cfg);
		@param {Object} config configuration object (aka model).
		**/
		loadPlayModel : function(config){
			console.log('%c\r\nAniPlay.loadPlayModel(config)', consoleStyle);
			//var scenario = this.convertToScenario(config);
			var scenario = config;
			var getLastChild = function(shapes){
				var lastShape = shapes[shapes.length-1];
				if(lastShape.children){
					return getLastChild(lastShape.children);
				}else{
					return lastShape;
				}
			};

			if(!scenario.scenes[0].layers[0].shapes){
				throw new Error('shapes not defined');
			}
			var shapes = scenario.scenes[0].layers[0].shapes;
			var lastChild = getLastChild(shapes);
			console.log('lastChild = '+lastChild.id);

			//check once
			if(document.getElementById(lastChild.id)){
				this.movieManager = MovieManager.create();
				this.movie = this.movieManager.loadScenario(scenario);
				setTimeout(function(that){

					console.log('AniGroup.isIDE = '+AniGroup.isIDE);

					//2013.12.09 bacause of pageshow
					if(AniGroup.isIDE === true){
						console.log('typeof that.movie.currentScene.id = '+typeof that.movie.currentScene.id);
						try{
							that.movie.loadScene(that.movie.currentScene);
						}catch(e){
							console.log(e.message);
						}
					}

					AniPlay.dom.dispatchEvent(
						window, 
						AniPlay.LOAD_PLAY_MODEL, {movie:this.movie},
						true, true);
				},300,this);
				console.log('Registry.getRegistry()',Registry.getRegistry());
				return true;
			}else{
				console.warn(lastChild.id+' element not found');
				return false;
			}
		},

		/**
		Gets animation groups from Scene object.

		@method getAniGroups
		@example
			AniPlay.getAniGroups(scene1);
		@param {Object} scene Scene instance
		@return {Array} [AniGroups]
		**/
		getAniGroups : function(scene){
			var i, result=[];
			for(i in scene.children){
				if(scene.children[i] instanceof AniGroup){
					result.push(scene.children[i]);
				}
			}
			return result;
		},

		/**
		Gets animation groups from Scene object by state.

		@method getGroupsByState
		@example
			AniPlay.getGroupsByState(scene1);
		@param {Object} scene Scene instance
		@param {String} state 'run' | 'pause' | 'stop'
		@return {Array} [AniGroups]
		**/
		getGroupsByState : function(scene, state){
			var i, result=[],
				aniGroups=this.getAniGroups(scene);
			for(i in aniGroups){
				
				console.log(aniGroups[i].id, aniGroups[i].action.state);
				
				if(aniGroups[i].action.state===state){
					result.push(aniGroups[i]);
				}
			}
			return result;
		},

		/**
		Gets animation groups from Registry by id(s).

		@method getGroupsById
		@example
			AniPlay.getGroupsById('Anim1');
			AniPlay.getGroupsById(['Anim1','Anim2']);
		@param {Mixed} ids
		@return {Array} [AniGroups]
		**/
		getGroupsById : function(ids){
			var i, result=[], aniGroup;
			if(typeof ids ==='string'){
				ids = [ids];
			}
			for(i in ids){
				aniGroup = Registry.getObjectById(ids[i],'AniGroup');
				if(aniGroup){
					result.push(aniGroup);
				}
			}
			return result;
		},

		/**
		Gets animation groups to be play automatically.

		@method getJustPlayGroups
		@example
			AniPlay.getJustPlayGroups(scene1);
		@param {Object} scene Scene instance
		@return {Array} [AniGroups]
		**/
		getJustPlayGroups : function(scene){
			var i, result=[],
				aniGroups=this.getAniGroups(scene);
			for(i in aniGroups){
				if(aniGroups[i].action.justplay===true){
					result.push(aniGroups[i]);
				}
			}
			return result;
		},

		/**
		Gets current active page.

		@method getCurrentPage
		@example
			AniPlay.getCurrentPage();
		@return {Object} scene Scene instance
		**/
		getCurrentPage : function(){
			console.log('AniPlay.getCurrentPage()');
			return this.movie.get('currentScene');
		},

		/**
		Plays all animation groups of current active page.

		@method playCurrentPage
		@example
			AniPlay.playCurrentPage();
		**/
		playCurrentPage : function(){
			console.log('%c\r\nAniPlay.playCurrentPage()',consoleStyle);
			this.playPage(this.movie.get('currentScene'));
		},

		/**
		Plays animation groups of page by Scene object (autoPlay true case only).

		@method playPage
		@example
			AniPlay.playPage(scene1);
		@param {Object} scene Scene instance
		**/
		playPage : function(scene){
			console.log('%c\r\nAniPlay.playPage(<Scene> '+scene.id+')',consoleStyle);
			this.playAniGroups(scene, this.getJustPlayGroups(scene));
		},

		/**
		Plays all animation groups of page by pageId

		@method playPageById
		@example
			AniPlay.playPageById('page1');
		@param {String} pageId page's id.
		**/
		playPageById : function(pageId){
			console.log('AniPlay.playPageById('+pageId+')');
			this.playPage(Registry.getObjectById(pageId,'Scene'));
		},

		/**
		Plays all animation groups of page by Scene object.

		@method playAllAniGroups
		@example
			AniPlay.playAllAniGroups(scene1);
		@param {Object} scene Scene instance
		**/
		playAllAniGroups : function(scene){
			console.log('%c\r\nAniPlay.playAllAniGroups(<Scene> '+scene.id+')', consoleStyle);
			this.playAniGroups(scene, this.getAniGroups(scene));
		},

		/**
		Plays animation groups on a page.

		@method playAniGroups
		@example
			AniPlay.playAniGroups(scene1, [aniGroup1, aniGroup2]);
		@param {Object} scene Scene instance.
		@param {Array} aniGroups Array of AniGroup instances.
		**/
		playAniGroups : function(scene, aniGroups){
			console.log('%cAniPlay.playAniGroups(<Scene> '+scene.id+', [aniGroups])', consoleStyle);
			console.log('aniGroups',aniGroups);
			var i,
				check = {stop:0,pause:0,run:0};
			for(i in aniGroups){
				check[aniGroups[i].action.state]++;
			}
			//nothing run
			if(check['run']===0){
				//if all stopped or paused
				if(check['pause']===0 || check['stop']===0){
					for(i in aniGroups){
						aniGroups[i].play();
					}
				//if some groups are stopped,
				//run `paused groups` only
				}else{
					for(i in aniGroups){
						if(aniGroups[i].action.state==='pause'){
							console.log(aniGroups[i].id+'.action.state = '+aniGroups[i].action.state);
							aniGroups[i].play();
						}
					}
				}
			}
		},

		/**
		Plays animation groups on a page.

		@method playAniGroupsById
		@example
			AniPlay.playAniGroupsById('page1', 'Anim1');
			AniPlay.playAniGroupsById('page1', ['Anim1', 'Anim2']);
		@param {String} pageId page's id.
		@param {Mixed} aniGroupIds The animation groups' ids.
		**/
		playAniGroupsById : function(pageId, aniGroupIds){
			console.log('AniPlay.playAniGroupsById('+pageId+', '+aniGroupIds+')');
			var scene = Registry.getObjectById(pageId,'Scene');
			var aniGroups = this.getGroupsById(aniGroupIds);
			this.playAniGroups(scene, aniGroups);
		},

		/**
		Pauses current page's all animation group(s).

		@method pauseCurrentPage
		@example
			AniPlay.pauseCurrentPage();
		**/
		pauseCurrentPage : function(){
			console.log('\r\nAniPlay.pauseCurrentPage()');
			this.pausePage(this.movie.get('currentScene'));
		},

		/**
		Pauses running animation group(s) of a page.

		@method pausePage
		@example
			AniPlay.pausePage(scene1);
		@param {Object} scene Scene instance
		**/
		pausePage : function(scene){
			console.log('AniPlay.pausePage(<Scene> '+scene.id+')');
			this.pauseAniGroups(scene, this.getGroupsByState(scene,'run'));
		},

		/**
		Pauses running animation group(s) of a page by pageId.

		@method pausePageById
		@example
			AniPlay.pausePageById('page1');
		@param {String} pageId page's id.
		**/
		pausePageById : function(pageId){
			console.log('AniPlay.pausePageById('+pageId+')');
			this.pausePage(Registry.getObjectById(pageId,'Scene'));
		},

		/**
		Pauses animation group(s) on a page.

		@method pauseAniGroups
		@example
			AniPlay.pauseAniGroups(scene1, [aniGroup1, aniGroup2]);
		@param {Object} scene Scene instance.
		@param {Array} aniGroups Array of AniGroup instances.
		**/
		pauseAniGroups : function(scene, aniGroups){
			var aniGroupIds=[];
			for(var i in aniGroups){
				aniGroupIds.push(aniGroups[i].id);
			}
			console.log('AniPlay.pauseAniGroups(<Scene> '+scene.id+', '+JSON.stringify(aniGroupIds)+')');
			var i;
			for(i in aniGroups){
				aniGroups[i].pause();
			}
		},

		/**
		Pauses animation group(s) on a page by Ids.

		@method pauseAniGroupsById
		@example
			AniPlay.pauseAniGroupsById('page1', 'Anim1');
			AniPlay.pauseAniGroupsById('page1', ['Anim1', 'Anim2']);
		@param {String} pageId page's id.
		@param {Mixed} aniGroupIds The animation groups' ids.
		**/
		pauseAniGroupsById : function(pageId, aniGroupIds){
			console.log('AniPlay.pauseAniGroups('+pageId+', '+aniGroupIds+')');
			var scene = Registry.getObjectById(pageId,'Scene');
			var aniGroups = this.getGroupsById(aniGroupIds);
			this.pauseAniGroups(scene, aniGroups);
		},

		/**
		Stops current page's all animation group(s).

		@method stopCurrentPage
		@example
			AniPlay.stopCurrentPage();
		**/
		stopCurrentPage : function(){
			console.log('\r\nAniPlay.stopCurrentPage()');
			this.stopPage(this.movie.get('currentScene'));
		},

		/**
		Stops all the animation group(s) of a page.

		@method stopPage
		@example
			AniPlay.stopPage(scene1);
		@param {Object} scene Scene instance
		**/
		stopPage : function(scene){
			console.log('AniPlay.stopPage(<Scene> '+scene.id+')');
			this.stopAniGroups(scene, this.getAniGroups(scene));
		},

		/**
		Stops all the animation group(s) of a page by pageId.

		@method stopPageById
		@example
			AniPlay.stopPageById('page1');
		@param {String} pageId page's id.
		**/
		stopPageById : function(pageId){
			console.log('AniPlay.stopPage('+pageId+')');
			this.stopPage(Registry.getObjectById(pageId,'Scene'));
		},

		/**
		Stops animation group(s) on a page.

		@method stopAniGroups
		@example
			AniPlay.stopAniGroups(scene1, [aniGroup1, aniGroup2]);
		@param {Object} scene Scene instance.
		@param {Array} aniGroups Array of AniGroup instances.
		**/
		stopAniGroups : function(scene, aniGroups){
			console.log('AniPlay.stopAniGroups(<Scene> '+scene.id+', [aniGroups])');
			var i;
			for(i in aniGroups){
				aniGroups[i].stop();
			}
		},

		/**
		Stops animation group(s) on a page by ids.

		@method stopAniGroupsById
		@example
			AniPlay.stopAniGroupsById('page1', 'Anim1');
			AniPlay.stopAniGroupsById('page1', ['Anim1', 'Anim2']);
		@param {String} pageId page's id.
		@param {Mixed} aniGroupIds The animation groups' ids.
		**/
		stopAniGroupsById : function(pageId, aniGroupIds){
			console.log('AniPlay.stopAniGroups('+pageId+', '+aniGroupIds+')');
			var scene = Registry.getObjectById(pageId,'Scene');
			var aniGroups = this.getGroupsById(aniGroupIds);
			this.stopAniGroups(scene, aniGroups);
		},

		/**
		Go to first frame of (a) aniGroup(s) in the current page(Scene).
		This will dispatch AniPlay.SET_TIME ('setTime') event to the elements of the group.

		@method goToStartFrame
		@example
			AniPlay.goToStartFrame('Anim1');
			AniPlay.goToStartFrame(['Anim1', 'Anim2']);
		@param {Mixed} [groupIds]  The animation group id(s).
		**/
		goToStartFrame : function(groupIds){
			console.log('\r\nAniPlay.goToStartFrame('+JSON.stringify(groupIds)+')');
			var aniGroups, i;
			if(groupIds){
				if(typeof groupIds ==='string'){groupIds=[groupIds];}
				aniGroups = this.getGroupsById(groupIds);
			}else{
				aniGroups = this.getAniGroups(this.movie.get('currentScene'));
			}
			for(i in aniGroups){
				aniGroups[i].goToStartFrame();
			}
		},

		/**
		Moves animations to a specific time. If you omit groupId, all AniGroups will be moved.

		@method setCurrentTime
		@example
			AniPlay.setCurrentTime(2500);
			AniPlay.setCurrentTime(2500, 'Anim1');
			AniPlay.setCurrentTime(2500, ['Anim1','Anim2']);
		@param {Integer} msec  The milisecond time to move.
		@param {Mixed} [groupIds]  The animation group id(s).
		@return {Object} CSS Properties of the contained widgets.
		**/
		setCurrentTime : function(msec, groupIds){
			console.log('%c\r\nAniPlay.setCurrentTime('+msec+', '+JSON.stringify(groupIds)+')', consoleStyle);
			var aniGroups, i;
			if(groupIds){
				if(typeof groupIds ==='string'){groupIds=[groupIds];}
				aniGroups = this.getGroupsById(groupIds);
			}else{
				aniGroups = this.getAniGroups(this.movie.get('currentScene'));
			}
			for(i in aniGroups){
				aniGroups[i].setCurrentTime(msec);
			}
		},

		/**
		Get css from animation group

		@method getCssByGroupId
		@example
			AniPlay.getCssByGroupId('Anim1');
			AniPlay.getCssByGroupId(['Anim1','Anim2']);
		@param {Mixed} [groupIds]  The animation group id(s).
		@return {Object} CSS Properties of the contained widgets by setTime event.
		**/
		getCssByGroupId : function(groupIds){
			console.log('%c\r\nAniPlay.getCssByGroupId('+groupIds+')', consoleStyle);
			var aniGroups, i;
			if(groupIds){
				if(typeof groupIds ==='string'){groupIds=[groupIds];}
				aniGroups = this.getGroupsById(groupIds);
			}else{
				aniGroups = this.getAniGroups(this.movie.get('currentScene'));
			}
			for(i in aniGroups){
				aniGroups[i].getCss();
			}
		},

		/**
		Sets widget element's visibility

		@method setVisible
		@example
			AniPlay.setVisible('image1', true);
		@param {String} nodeId  animation's target node id
		@param {Boolean} isVisible  true to visible, false to hidden
		**/
		setVisible : function(nodeId, isVisible){
			console.log('%c\r\nAniPlay.setVisible('+nodeId+', '+isVisible+')', consoleStyle);
			var node = Registry.getObjectById(nodeId, 'Node');
			node.set('visible', isVisible);
			console.log(node);
		},

		/**
		When an aniGroup start, this event will be fired on an animation group element(invisible).
		
		@event ANI_GROUP_START
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupStart'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_START, function(oEvent){console.log(oEvent.bundle);});
		**/
		ANI_GROUP_START : AniGroup.ANI_GROUP_START,

		/**
		When an aniGroup iteration start, this event will be fired on an animation group element(invisible).
		
		@event ANI_GROUP_ITERATION
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupIteration'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_ITERATION, function(oEvent){console.log(oEvent.bundle);});
		**/
		ANI_GROUP_ITERATION : AniGroup.ANI_GROUP_ITERATION,

		/**
		When an aniGroup end, this event will be fired on an animation group element(invisible).
		
		@event ANI_GROUP_END
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupEnd'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_END, function(oEvent){console.log(oEvent.bundle);});
		**/
		ANI_GROUP_END : AniGroup.ANI_GROUP_END,

		/**
		The stop event is called when aniGroup's animation ended or an user stops aniGroup's animation.
		This event would be dispatched after AniPlay.ANI_GROUP_END event.

		@event ANI_GROUP_STOP
		@bubbles true
		@param {Event} event As a result, event object's bundle object would contain Object similar to this
		 : {aniGroupId: "Anim1", animateId: "Anim1"}
		@value {String} 'aniGroupStop'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_STOP, function(oEvent){console.log(oEvent.bundle);});
		**/
		ANI_GROUP_STOP : AniGroup.ANI_GROUP_STOP,

		/**
		Called when all the aniGroup's animation has been ended.

		@event ALL_ANI_GROUP_STOP
		@bubbles true
		@value {String} 'allAniGroupStop'
		@example
			document.addEventListener(AniPlay.ALL_ANI_GROUP_STOP, function(oEvent){console.log(oEvent);});
		**/
		ALL_ANI_GROUP_STOP : 'allAniGroupStop',

		/**
		Called when AniGroup instance's setCurrentTime() method is called.
		Event Object has a bundle object that contains selector name, css collection of the element
		and currentTime of the Animate Class instance. See examples.

		@event SET_TIME
		@bubbles true
		@value {String} 'setTime'
		@example
			document.addEventListener(AniPlay.SET_TIME, function(oEvent){console.log(oEvent.bundle);});
			document.addEventListener(
				AniPlay.SET_TIME, function(oEvent){
					console.log(oEvent.bundle.selector, JSON.stringify(oEvent.bundle.css), oEvent.bundle.currentTime);
			});
		**/
		SET_TIME : 'setTime',

		/**
		Called when an aniGroup is playing

		@event ANI_GROUP_TIME_UPDATE
		@bubbles true
		@value {String} 'aniGroupTimeUpdate'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_TIME_UPDATE, function(oEvent){
				console.log(oEvent.bundle);
				//{id: "anim2", currentTime: 5379} 
			});
		**/
		ANI_GROUP_TIME_UPDATE : AniGroup.ANI_GROUP_TIME_UPDATE,

		/**
		Called when an aniGroup duration changed by sub animation.

		@event ANI_GROUP_DURATION_UPDATE
		@bubbles true
		@value {String} 'aniGroupDurationUpdate'
		@example
			document.addEventListener(AniPlay.ANI_GROUP_DURATION_UPDATE, function(oEvent){
				console.log(oEvent.bundle);
				//{id:'aniGroup1', duration: 2100} 
			});
		**/
		ANI_GROUP_DURATION_UPDATE : 'aniGroupDurationUpdate',

		/**
		Called when the AniPlay Framework is ready to use.
		You must use String 'aniPlayReady' rather than constant AniPlay.ANI_PLAY_READY
		because of AMD issue (Require.js loads modules asynchronously).

		@event ANI_PLAY_READY
		@bubbles true
		@value {String} 'aniPlayReady'
		@example
			window.addEventListener('aniPlayReady', function(oEvent){console.log(oEvent.bundle);});
		**/
		ANI_PLAY_READY : 'aniPlayReady',

		/**
		Called when the new animation config loaded.

		@event LOAD_PLAY_MODEL
		@bubbles true
		@value {String} 'loadPlayModel'
		@example
			window.addEventListener(AniPlay.LOAD_PLAY_MODEL, function(oEvent){
				console.log(oEvent.bundle);
				//{movie: Movie Node Object} 
			});
		**/
		LOAD_PLAY_MODEL : 'loadPlayModel'
	};

	AniPlay.dom.addEvent(document, AniPlay.ANI_GROUP_START, function(oEvent){
		
	});

	AniPlay.dom.addEvent(document, AniPlay.ANI_GROUP_STOP, function(oEvent){
		logger.event(AniPlay.ANI_GROUP_STOP);
		var scene = oEvent.bundle.aniGroup.parent,
			aniGroups = AniPlay.getAniGroups(scene),
			stopGroups = AniPlay.getGroupsByState(scene,'stop');
			//console.log(aniGroups.length, stopGroups.length);
			setTimeout(function(scene){
				if(aniGroups.length==stopGroups.length){
					AniPlay.dom.dispatchEvent(
						scene.dom.element, 
						AniPlay.ALL_ANI_GROUP_STOP, {},
						true, true);
				}
			},1,scene);
	});

	module.exports = AniPlay;
});