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
		logger = require('common/logger'),
		string = require('common/string'),
		dom = require('common/dom'),
		css = require('common/css'),
		Dom = require('dom/Dom'),
		Scene = require('nodes/Scene'),
		Layer = require('nodes/Layer'),
		Animate = require('actions/Animate'),
		BaseObject = require('bases/BaseObject'),
		Registry = require('bases/Registry');

	var makeAniGroupAni = function(id){
		if(!dom.byId('aniplaystyle')){
			dom.makeElement('style',{id:'aniplaystyle'});
		}
		var styleSheets = document.styleSheets,
			lastSheet = styleSheets[styleSheets.length-1],
			pos = lastSheet.cssRules ? lastSheet.cssRules.length : 0;
		css.insertRule(lastSheet, '@'+css.inlinePrefix+'keyframes '+id, 'from{opacity:0} to{opacity:0.5}', pos);
	};

	var makeAniGroupElement = function(scene,id){
		return dom.makeElement('div', {
			id : id,
			style : 'visibility:hidden,width:0;height:0;'
		},{element:scene.dom.element, position:'inside'});
	};

/*
	dom.addEvent(document, Scene.CLONE_READY, function(oEvent){
		logger.event(Scene.CLONE_READY);
		var i, children;
		if(oEvent.bundle.scene){
			children = oEvent.bundle.scene.children;
			for(i in children){
				if(children[i] instanceof AniGroup){
					children[i].detectCss();
				}
			}
		}
	});
*/

	var AniGroup = util.Class({
		name : 'AniGroup',
		extend : Layer,
		init : function(p){
			AniGroup.super.init.apply(this, arguments);

			//AniGroup CSS Animation
			makeAniGroupAni(this.id);

			//AniGroup.isIDE
			console.log('AniGroup.isIDE = '+AniGroup.isIDE);
			if(AniGroup.isIDE){
				p.iteration = 1;
			}

			//AniGroup Animate
			//currently delay,direction,timing are fixed values
			this.set('action', Animate.create({
				id : this.id,
				delay: '0s',
				direction : 'normal',
				timing : 'linear',
				duration : p.duration,
				iteration : p.iteration,
				justplay : p.justplay,
				holdEnd : p.holdEnd,
				handlers : {
					start : function(animate){
						animate.target.playPairs();
						dom.dispatchEvent(animate.target.dom.element, 
							AniGroup.ANI_GROUP_START, {
								aniGroup:animate.target,
								aniGroupId:animate.target.id,
								animateId:animate.id
							},true,true);
					},
					iteration : function(animate){
						animate.target.stopPairs();
						animate.target.playPairs();
						dom.dispatchEvent(animate.target.dom.element, 
							AniGroup.ANI_GROUP_ITERATION, {
								aniGroup:animate.target,
								aniGroupId:animate.target.id,
								animateId:animate.id
							},true,true);
					},
					end : function(animate){
						console.log('<Animate> '+animate.id+'.handlers.end('+animate.id+')');
						dom.dispatchEvent(animate.target.dom.element, 
							AniGroup.ANI_GROUP_END, {
								aniGroup:animate.target,
								aniGroupId:animate.target.id,
								animateId:animate.id
							},true,true);
						setTimeout(function(animate){
							if(animate.target){
								animate.target.stop();
							}
						},50,animate);
					},
					resumeTime : function(animate){
						console.log('<Animate> '+animate.id+'.handlers.resumeTime('+animate.id+')');
						animate.target.resumeTimePairs();
					}
				}
			}));

			//members Animate
			if('members' in p && p.members.length){
				var i, targetId, action, member;
				for(i in p.members){
					member = p.members[i];
//					if(parseFloat(member.animation.duration)>0){
						targetId = member.id;
						action = Animate.create(member.animation);
						this.makePair(targetId, action);
						this.addChild(Registry.getObjectById(targetId, 'Shape'));
//					}
				}
			}
		},
		dynamics : {
			action : null,
			pairs : null,
			makePair : function(targetId, action){
				if(!this.pairs){
					this.pairs = {};
				}
				this.setAssoc('pairs', targetId, action);
			},
			addToScene : function(scene){
				scene.addChild(this);
				//AniGroup element
				makeAniGroupElement(scene, this.id);
				this.set('dom', Dom.create({id:this.id}));
			},

			repeater : null,
			currentTime : 0,
			currentTimePaused : 0,
			
			runRepeater : function(){
				console.log('<AniGroup> '+this.id+'.runRepeater()');
				console.log('  this.currentTimePaused = '+this.currentTimePaused);
				console.log('  this.repeater = '+this.repeater);
				if(this.repeater===null){
					var startMs = (new Date()).getTime();
					this.repeater = setInterval(function(that){
						var nodeId, node, animate;
						var delta = (new Date()).getTime() - startMs + that.currentTimePaused;
						//console.log('delta = '+delta);
						if(that.action.totalDuration > delta){
							that.currentTime = delta;
							//console.log('timeupdate', that.currentTime);
						}else{
							that.currentTime = that.action.totalDuration;
						}
						dom.dispatchEvent(that.dom.element, 
							AniGroup.ANI_GROUP_TIME_UPDATE, {
								id : that.dom.element.id,
								currentTime : that.currentTime
							},true,true);
						//Sync currentTime
						for(nodeId in that.pairs){
							node = Registry.getObjectById(nodeId,'Node');
							animate = that.pairs[nodeId];
							if(node && animate){
								animate.set('currentTime', that.currentTime - parseFloat(animate.delay)*1000);
								//console.log(nodeId, 'animate.currentTime = ',animate.currentTime);
							}
						}	
					},1,this);
				}else{
					console.log('repeater exists. this.repeater = '+this.repeater);
				}
			},
			pauseRepeater : function(currentTime){
				clearInterval(this.repeater);
				this.currentTimePaused = currentTime;
				this.repeater = null;
			},
			stopRepeater : function(){
				clearInterval(this.repeater);
				this.repeater = null;
				this.currentTime = 0;
				this.currentTimePaused = 0;
			},

			play : function(){
				var timelineState = {
					0 : 'IS_NORMAL',
					1 : 'IS_SET_TIME',
					2 : 'IS_RESUME_TIME',
					3 : 'IS_DETECT_START'
				};
				console.log('\r\n<AniGroup> '+this.id+'.play(), this.action.state='+this.action.state+', timelineState='+timelineState[this.action.timelineState]);

				//Is set by Current Time
				if(this.action.timelineState===Animate.IS_SET_TIME){

					console.log('this.action.currentTime = '+this.action.currentTime);
					console.log('this.action.totalDuration = '+this.action.totalDuration);

					//normal
					if(this.action.currentTime < this.action.totalDuration){
						//Is set by setTime (under timeline)
						if(this.action.state == 'pause'){
							console.log('play() case 1');
							this.resumeTime();
						//Other Case
						}else{
							console.log('play() case 2');
							console.warn('other case : see here');
							return;
						}
					//overtime (stop or paused : there is a bug with webkit)
					}else{
						console.log('play() case 3');
						//init again then play
						this.stop();
						setTimeout(function(aniGroup){
							aniGroup.play();
						},10,this);
						return;
					}
					
				//Normal
				}else{
					//Stopped (both inside and outside of duration)
					if(this.action.state == 'stop'){
						console.log('play() case 4');
						this.stopRepeater();
						this.runAction(this.action);
					//Paused
					}else if(this.action.state == 'pause'){
						console.log('play() case 5');
						this.resume();
					//Other Case
					}else{
						console.log('play() case 6');
						console.warn('other case : see here');
						return;
					}
				}
				this.runRepeater();
			},
			resumeTime : function(){
				console.log('\r\n<AniGroup> '+this.id+'.resumeTime()');
				this.action.resumeTimeWith(this);
			},
			resumeTimePairs : function(){
				console.log('\r\n<AniGroup> '+this.id+'.resumeTimePairs()');
				var nodeId, node, animate, delay, duration, msecToPlay;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.resumeTimeWith(node);
					}
				}
			},
			pause : function(){
				console.log('<AniGroup> '+this.id+'.pause()');
				this.pausePairs();
				this.pauseAction(this.action);
				this.pauseRepeater(this.currentTime);
			},
			resume : function(){
				console.log('<AniGroup> '+this.id+'.resume()');
				this.resumeAction(this.action);
				this.resumePairs();
			},
			stop : function(){
				console.log('<AniGroup> '+this.id+'.stop()');
				this.stopPairs();
				this.stopAction(this.action);
				dom.dispatchEvent(this.dom.element, 
					AniGroup.ANI_GROUP_STOP, {
						aniGroup:this,
						aniGroupId:this.id,
						animateId:this.action.id
					},true,true);
				this.stopRepeater();
			},
			playPairs : function(){
				console.log('<AniGroup> '+this.id+'.playPairs()');
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						node.runAction(animate);
					}
				}
			},
			pausePairs : function(){
				console.log('<AniGroup> '+this.id+'.pausePairs()');
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						node.pauseAction(animate);
					}
				}
			},
			resumePairs : function(){
				console.log('<AniGroup> '+this.id+'.resumePairs()');
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						node.resumeAction(animate);
					}
				}
			},
			stopPairs : function(){
				console.log('<AniGroup> '+this.id+'.stopPairs()');
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						//TODO Should I check exist then stop it?
						node.stopAction(animate);
					}
				}
			},
			goToStartFrame : function(){
				console.log('\r\n<AniGroup> '+this.id+'.goToStartFrame()');
				this.stopRepeater();
				this.action.goToStartFrameWith(this);
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.goToStartFrameWith(node);
					}
				}
			},
			resetAniGroup : function(){
				console.log('\r\n<AniGroup> '+this.id+'.resetAniGroup()');
				this.stopRepeater();
				this.action.goToStartFrameWith(this);
				var nodeId, node, animate;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.goToStartFrameWith(node);
					}
				}
			},
			setCurrentTime : function(msec){
				console.log('%c\r\n<AniGroup> '+this.id+'.setCurrentTime('+msec+')', 'font-weight:bold; color:blue');

				var nodeId, node, animate, delay, duration, msecToPlay, groupLooped;

				//overtime
				if(msec >= this.action.totalDuration){
					msecToPlay = this.action.totalDuration;
					console.log('***** AniGroup > action over action.totalDuration ! *****');
					//msecToPlay = msecToPlay;
					//this.action.set('state','stop');
				}else{
					msecToPlay = msec;
				}
				this.action.setTimeWith(this, msecToPlay);

				//groupLooped
				groupLooped = this.action.totalDuration*this.action.iterated;
				//console.log(this.id+' > groupLooped = ',groupLooped);

				//first
				if(parseFloat(msec)===0){
					this.stopRepeater();
				//last
				}else if(parseFloat(msec)===this.action.totalDuration){
					this.stopRepeater();
				//normal
				}else{
					this.pauseRepeater(msec);			
				}

				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){

						//over totalDuration
						if(msec >= this.action.totalDuration){
							msecToPlay = this.action.totalDuration - parseFloat(animate.delay)*1000;
							console.log('***** Node > animate over action.totalDuration ! *****');
							//msecToPlay = msecToPlay;
							//animate.set('state','stop');
						}else{
							delay = parseFloat(animate.delay)*1000;
							duration = parseFloat(animate.duration)*1000;
							//console.log('---> ', msec, delay, groupLooped, this.action.totalDuration);
							msecToPlay = msec - delay - groupLooped; //distance from start play
							//console.log('---> msecToPlay = ', msecToPlay);
							//console.log(node.id, 'msecToPlay = '+msecToPlay+', duration = '+duration+', this.action.totalDuration = '+this.action.totalDuration);
						}
						animate.setTimeWith(node, msecToPlay);
					}
				}


			},
			getCss : function(){
				console.log('\r\n<AniGroup> '+this.id+'.getCss()');
				var nodeId, node, animate, element;
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						element = node.dom.element;
						//fire onSetTime event
						Animate.dispatchSetTimeEvent(
							element, 
							'#'+element.id, //TODO modify to Selector (until 1st week of Oct) 
							animate.currentTime 
						);
					}
				}
			},
			detectCss : function(){
				console.log('%c<AniGroup> '+this.id+'.detectCss()', 'color:yellowgreen');
				var nodeId, node, animate;
				this.action.detectStyleWith(this); //group
				for(nodeId in this.pairs){
					node = Registry.getObjectById(nodeId,'Node');
					animate = this.pairs[nodeId];
					if(node && animate){
						animate.detectStyleWith(node); //node
					}
				}
			}
		},
		statics : {
			isIDE : false,
			ANI_GROUP_START : 'aniGroupStart',
			ANI_GROUP_ITERATION : 'aniGroupIteration',
			ANI_GROUP_END : 'aniGroupEnd',
			ANI_GROUP_STOP : 'aniGroupStop',
			ANI_GROUP_TIME_UPDATE : 'aniGroupTimeUpdate'
		}
	});

	module.exports = AniGroup;
});