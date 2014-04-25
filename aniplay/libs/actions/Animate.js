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
		env = require('common/env'),
		logger = require('common/logger'),
		string = require('common/string'),
		dom = require('common/dom'),
		css = require('common/css'),
		Registry = require('bases/Registry'),
		Action = require('actions/Action');

	var subLen = 10;
	if(css.inlinePrefix.length){
		subLen = 10 + css.inlinePrefix.length;
	}
	console.log('subLen = '+subLen);

	var Animate = util.Class({
		name : 'Animate',
		extend : Action,
		init : function(p){
			Animate.super.init.apply(this, arguments);
			this.set('delay', p.delay || '0s');
			this.set('duration', p.duration || '0s');
			this.set('iteration', p.iteration || 1);
			if(this.iteration==='infinite'){
				this.iteration = Number.MAX_VALUE/10000000;
			}
			this.set('direction', p.direction || 'normal');
			this.set('fillmode', p.fillmode || 'forwards');
			this.set('timing', p.timing || 'ease');
			if(p.justplay===true){
				this.set('justplay', true);
			}else{
				this.set('justplay', false);
			}
			this.set('holdEnd', p.holdEnd || false);
			this.set('handlers', {
				start : function(){},
				iteration : function(){},
				end : function(){},
				resumeTime : function(){}
			});
			if(p.handlers){
				if(typeof p.handlers.start==='function'){
					this.setAssoc('handlers','start',p.handlers.start);
				}
				if(typeof p.handlers.iteration==='function'){
					this.setAssoc('handlers','iteration',p.handlers.iteration);
				}
				if(typeof p.handlers.end==='function'){
					this.setAssoc('handlers','end',p.handlers.end);
				}
				if(typeof p.handlers.resumeTime==='function'){
					this.setAssoc('handlers','resumeTime',p.handlers.resumeTime);
				}
			}
			this.set('delayRemain', parseFloat(this.delay)*1000);
			this.set('totalDuration', parseFloat(this.duration)*this.iteration*1000);
			this.set('currentTime', -1*this.delayRemain);
		},
		dynamics : {
			delay : null,
			duration : null,
			iteration : null,
			direction : null,
			fillmode : null,
			timing : null,
			justplay : null,
			handlers : null,
			holdEnd : null,
			iterated : 0,
			beforeCss : null,
			originCss : null,
			startCss : null,
			endCss : null,
			startMs : 0,
			delayRemain : null, //Check the animation is in a running state or not (To process delayed animations)
			currentTime : 0,
			timelineState : 0,
			totalDuration : 0,
			noMove : false,
			bindAnimation : function(element, prop){
				console.log('<Animate> '+this.id+'.bindAnimation('+element.id+', prop)');
				prop.name = prop.id;
				css.setAnimation(element, prop);
				this.updateStartMs();
			},
			unbindAnimation : function(){
				console.log('<Animate> '+this.id+'.unbindAnimation()');
				if(this.target){
					var element = this.target.dom.element;
					css.resetAnimation(element);
					var clone = dom.byId('clone_'+element.id);
					if(clone){css.resetAnimation(clone);}
				}
			},
			updateStartMs : function(){
				this.set('startMs', (new Date()).getTime());
			},
			runWithDelay : function(element, delayMs){
				console.log('%c<Animate> '+this.id+'.runWithDelay('+element.id+', '+delayMs+')', 'color:red');
				this.bindAnimation(element, {
					id : this.id,
					delay : (delayMs/1000)+'s',
					fillmode : this.fillmode,
					duration : this.duration,
					direction : this.direction,
					timing : this.timing,
					iteration : this.iteration,
					playState : 'running'
				});
			},
			setStartPos : function(node){
				console.log('<Animate> '+this.id+'.setStartPos('+node.id+')');
				if(this.endCss){
					this.beforeCss = this.endCss;
				}
				if(this.startCss){
					this.setStyleByDiff(node.dom.element, this.startCss);
				}
			},
			runWith : function(node){
				//this.target HOW? TODO:
				console.log('<Animate> '+this.id+'.runWith('+node.id+')');

				//set start state
				this.setStartPos(node);

				//unbind if exists and reset conditional vars
				this.unbindAnimation();
				this.resetStates();

				console.log('this.target', this.target);
				console.log(node.dom.element.style[css.fixProp('animationName')]);
				//console.log('this.target._uid',this.target._uid);
				//console.log('node._uid',node._uid);
				if(this.target && this.target._uid===node._uid){
					this.stopWith(this.target);
				}
				setTimeout(function(that, args, node){
					Animate.super.runWith.apply(that, args);
					that.bindAnimation(node.dom.element, that);
				},1,this,arguments,node);
				
			},
			pauseWith : function(node){
				console.log('<Animate> '+this.id+'.pauseWith('+node.id+')');
				var style = node.dom.style;
				//console.log('    this.state = '+this.state+", style[this.fixProp('animationName')] = "+style[css.fixProp('animationName')]);
				if(style[css.fixProp('animationName')] && this.state==='run'){
					Animate.super.pauseWith.apply(this, arguments);

					//delayed and before run
					if(this.delayRemain > 0){
						var delta = (new Date()).getTime() - this.startMs; //played time
						this.set('delayRemain', this.delayRemain - delta);
						console.log('    @@ delta = '+delta);
						console.log('    @@ this.delayRemain = '+this.delayRemain);
					}

					//not yet run
					if(this.delayRemain > 0){
						var log = '    @@ delayed : this.id = '+this.id+', ';
							log += 'this.target.id = '+this.target.id+", ";
							log += "style[css.fixProp('animationDelay')] = "+style[css.fixProp('animationDelay')];
						console.log(log);
						this.unbindAnimation();
					//in run state
					}else{
						style[css.fixProp('animationPlayState')] = 'paused';
					}
				}
			},
			resumeWith : function(node){
				console.log('resumeWith('+node.id+')');
				var style = node.dom.style;
				this.set('timelineState', 0);
				if(style[css.fixProp('animationName')] && this.state==='pause'){
					Animate.super.resumeWith.apply(this, arguments);
					style[css.fixProp('animationPlayState')] = 'running';
				}
				//delayed before run
				if(this.delayRemain > 0 && this.state==='pause'){
					console.log('    @@ this.state = '+this.state);
					Animate.super.resumeWith.apply(this, arguments);
					//console.log('@@ delayed : this.delayRemain = '+this.delayRemain);
					this.runWithDelay(node.dom.element, this.delayRemain);
				}
			},
			resetStates : function(){
				console.log('<Animate> '+this.id+'.resetStates()');
				this.set('startMs', 0);
				this.set('timelineState', 0);
				this.set('iterated', 0);
				this.set('delayRemain', parseFloat(this.delay)*1000); //init again
				this.set('currentTime', -1*this.delayRemain);
			},
			stopWith : function(node){
				console.log('<Animate> '+this.id+'.stopWith('+node?node.id:''+')');
				//to hold end state
				console.log('this.holdEnd = '+this.holdEnd);
				if(this.holdEnd===true && this.target){
					this.detectEndCss();
					this.beforeCss = this.startCss;
					this.setStyleByDiff(this.target.dom.element, this.endCss, true);
				}
				this.unbindAnimation();
				this.resetStates();
				Animate.super.stopWith.apply(this, arguments);
			},
			detectStyleWith : function(node){
				console.log('\r\n<Animate> '+this.id+'.detectStyleWith('+node.id+')');
				this.detectOriginCss(node);
				setTimeout(function(that,node){
					that.detectStartCss(node);
				},1,this,node);
			},
			detectOriginCss : function(node){
				console.log('%c<Animate> '+this.id+'.detectOriginCss('+node.id+')', 'color:#56A5EC');
				var element = node.dom.element;
                var originCss = Animate.getCloneStyle(element);
				this.set('originCss', originCss);
				console.log(this.id+".originCss['-webkit-transform'] = "+this.originCss['-webkit-transform']);
				console.log(logger.check(this.originCss,this.id+'.originCss'));
			},
			detectStartCss_old : function(node){
				console.log("<Animate> " + this.id + ".detectStartCss(" + node.id + ")");
                var element = node.dom.element;
                var clone = dom.byId('clone_'+element.id);
				this.set("timelineState", Animate.IS_DETECT_START), 
				this.set("target", node), 
				this.runWithDelay(clone, 0);
			},
			detectStartCss : function(node){
				console.log('%c\r\n<Animate> '+this.id+'.detectStartCss('+node.id+')', 'color:#56A5EC');
				var element = node.dom.element;
				var clone = dom.byId('clone_'+element.id);

//				console.log('--before');
//                console.log(node.id+' > '+JSON.stringify(Animate.getCloneStyle(clone)));

                //Bind with pause
                this.bindAnimation(clone, {
                    id : this.id,
                    delay : '0s',
                    fillmode : this.fillmode,
                    duration : this.duration,
                    direction : this.direction,
                    timing : this.timing,
                    iteration : this.iteration,
                    playState : 'pause'
                });

                //startStyle
                var startCss = Animate.getCloneStyle(clone);
				this.set('startCss', startCss);
				//console.log(this.id+".startCss = ", this.startCss);
				console.log(this.id+".startCss['-webkit-transform'] = "+this.startCss['-webkit-transform']);
				console.log(logger.check(this.startCss,this.id+'.startCss'));

				//add new styles of startCss to origin
/*
				for(var p in startCss){
					if(typeof this.originCss[p] === 'undefined'){
						this.originCss[p] = startCss[p];
					}
				}
*/
//				console.log('--after');
//				console.log(node.id+' > '+JSON.stringify(this.startCss));
                //console.log('startCss', startCss);
                //console.log(this.id+'.startCss.opacity = '+this.startCss.opacity);

                setTimeout(function(clone,node,animate){
                    //Reset Animation
                    css.resetAnimation(clone);
                    //fire onSetTime event
                    dom.dispatchEvent(node.dom.element, 
                        Animate.DETECT_START_CSS, {
                            animate : animate,
                            node : node
                        },true,true);

                },0,clone,node,this);
			},
			detectEndCss : function(){
				console.log('%c\r\n<Animate> '+this.id+'.detectEndCss()', 'color:#56A5EC');
				if(this.target!=null){
					this.set('endCss', Animate.getCloneStyle(this.target.dom.element));
					console.log(this.id+".endCss['-webkit-transform'] = "+this.endCss['-webkit-transform']);
					console.log(logger.check(this.endCss,this.id+'.endCss'));
				}
			},
			setStyleByDiff : function(element, style, isLog){
				console.log('<Animate> '+this.id+'.setStyleByDiff('+element.id+',style)');
				if(this.beforeCss==null){
					this.beforeCss = this.originCss;
				}

				var diff = dom.getComputedStyleDiff(this.beforeCss, style);
				if(isLog){console.log('diff = ', diff);}
				//if(1){console.log(logger.check(diff,'diff'));}
				dom.setStyles(element, diff);

				this.beforeCss = style;

				//fire onSetTime event
				Animate.dispatchSetTimeEvent(
					element, 
					'#'+element.id, //TODO modify to Selector 
					this.currentTime,
					this);
			},
			goToStartFrameWith : function(node){
				console.log('%c<Animate> '+this.id+'.goToStartFrameWith('+node.id+')', 'color:#4EE2EC');
				var element = node.dom.element;
				this.stopWith(node); //reset all
				this.setStyleByDiff(element, this.startCss);
			},
			resumeTimeWith : function(node){
				console.log('%c<Animate> '+this.id+'.resumeTimeWith('+node.id+')', 'color:blue');
				this.set('timelineState', Animate.IS_RESUME_TIME);
				this.set('state', 'run');
				this.set('target', node);
				this.runWithDelay(node.dom.element, -1*this.currentTime);
				//resume position is -1*this.currentTime
				//2013.09.17 until now here
				//TODO : run() then setCurrentTime(), Eliminate aniImage2ing
				//Refer to prototyping html of setCurrentTime
			},
			update : function(durationMs, delayMs){
				console.log('<Animate> '+this.id+'.update('+durationMs+', '+delayMs+')');

				if(typeof delayMs != 'undefined'){
					var delayDelta = delayMs - parseFloat(this.delay)*1000;
					var delayRemain = this.delayRemain + delayDelta;
					console.log('delayDelta = '+delayDelta+', delayRemain = '+delayRemain);
					if(delayRemain < 0){
						console.log('oops');
						delayRemain = 0;
					}
					this.set('delay', (delayMs/1000)+'s');
					this.set('delayRemain', delayRemain);
					this.set('currentTime', this.currentTime - delayDelta);
					console.log('this.currentTime =>> '+this.currentTime);
				}

				if(typeof durationMs != 'undefined'){
					this.set('duration', (durationMs/1000)+'s');
					this.set('totalDuration', durationMs*this.iteration);
					this.set('iterated', Math.floor(this.currentTime/durationMs));
				}
				console.log(this);
			},
			setTimeWith : function(node, msec, ignoreDelta){
				console.log('\r\n● <Animate> '+this.id+'.setTimeWith('+node.id+','+msec+')');

				console.log('this.duration = '+this.duration);
				console.log('node.dom.element.id = '+node.dom.element.id);
				if(parseFloat(this.duration)==0){
					console.log(this.id+' : this.duration == 0');
					console.log("  ### return ###\r\n");
					return;
				}
				var element = node.dom.element;
				var delta = Math.abs(this.currentTime - msec);

				console.log('  >>>> this.totalDuration = '+this.totalDuration+', this.delay = '+this.delay+', this.currentTime = '+this.currentTime+', msec = '+msec+', delta = '+delta);

				var actualPos = parseFloat(this.delay)*1000 + msec;
				console.log('actualPos = '+actualPos);

				//start position
				if(actualPos==0){
					this.unbindAnimation();
					this.resetStates();
				}else{
					//pass under 0.1ms
					if(delta <= 0.5 && !ignoreDelta){
						console.log("  ### delta <= 0.1 && !ignoreDelta return ###\r\n");
						return;
					}
				}

				this.set('currentTime', msec);
				this.set('timelineState', Animate.IS_SET_TIME);
				if(msec < this.totalDuration){
					this.set('state', 'pause');
				}else{
					this.set('state', 'stop');
				}

				// 0. origin running state
				if(element.style[css.fixProp('animationPlayState')]==='running'){
					this.unbindAnimation();
					element.style.visibility = 'hidden'; //hide temporally
				}

				// 1. Clone
				var clone = dom.byId('clone_'+element.id);

				// + avoid overlap of running
				if(	clone.style[css.fixProp('animationName')]!='none' && 
					clone.style[css.fixProp('animationPlayState')]==='running'){
					console.log("clone.style[css.fixProp('animationName')] = "+clone.style[css.fixProp('animationName')]);
					console.log("clone.style[css.fixProp('animationPlayState')] = running");

					//QT BUG FIX
					if(env.agent==='qt'){
						setTimeout(function(clone){
							css.resetAnimation(clone);
						},1,clone);
					}else{
						css.resetAnimation(clone);
					}
				}

				// + paused state
				if(	element.style[css.fixProp('animationName')]!=='' && 
					element.style[css.fixProp('animationPlayState')]==='paused'){
					console.log('>>> paused !!!');
					this.unbindAnimation();
				}

				var durationMs = parseFloat(this.get('duration'))*1000,
					iterated;

				//Normal Case
				if(msec >= 0){

					this.set('delayRemain', 0);
					this.set('iterated', Math.floor(msec/durationMs));

				//if msec is negative then the animation will have delay.
				//before play (msec < delay) (Not yet played)
				}else{
					this.set('delayRemain', -1*msec);
					this.set('iterated', 0);
					msec = 0;
				}
				console.log('  >> this.currentTime = '+this.currentTime);
				console.log('  >> this.delayRemain = '+this.delayRemain);
				console.log('  >> this.iterated = '+this.iterated);

				// 2.move clone
			    this.runWithDelay(clone, -1*msec);
				this.set('target', node);
			}
		},
		statics : {
			IS_SET_TIME : 1,
			IS_RESUME_TIME : 2,
			IS_DETECT_START : 3,
			IS_GET_CSS : 4,
			DETECT_START_CSS : 'detectStartCss',
			SET_TIME : 'setTime',
			eventLog : function(animate, oEvent, eventState){
				if(!animate.target){return;}
				console.log('');
				var timelineState = {
					0 : 'IS_NORMAL',
					1 : 'IS_SET_TIME',
					2 : 'IS_RESUME_TIME',
					3 : 'IS_DETECT_START'
				};
				logger.event(oEvent.animationName+' -> '+oEvent.target.id +' > '+eventState+', timelineState='+timelineState[animate.timelineState]);
			},
			dispatchSetTimeEvent : function(element, selector, currentTime, animate){
				dom.dispatchEvent(element, 
					Animate.SET_TIME, {
						selector : selector,
						currentTime : currentTime,
						css : dom.getComputedStyleClone(element),
						animate : animate
					},true,true);
			},
			addAniEvent : function(){
				console.log('Animate::addAniEvent()');
				dom.addEvent(document, css.fixEvent('animationStart'), function(oEvent){

					console.log('---------- animationStart >> '+oEvent.animationName);

					var animate = Registry.getObjectById(oEvent.animationName, 'Animate');
					if(typeof animate === 'undefined'){return;}
					
					var node = animate.target;
					if(!node){return;}
					var element = node.dom.element;
					var clone = dom.byId('clone_'+element.id);
					Animate.eventLog(animate, oEvent, 'Start');

					//reset above <0. origin running state>
					if(node.visible===true){
						element.style['visibility'] = 'visible';
					}

					//setTimeWith
					if(animate.timelineState===Animate.IS_SET_TIME){

						clone.style[css.fixProp('animationPlayState')] = 'paused';
						var movedStyle = Animate.getCloneStyle(clone);

						//TODO : check wheather things changed
						var ch = dom.checkComputedStyleDiff(animate.originCss, movedStyle);
//						var ch = true;
//						if((animate.startCss.top === movedStyle.top)){
//							ch=false;
//						}
						if(animate.currentTime > 0 && ch===false){
							console.log('animate.originCss === movedStyle --> dom.setStyles() canceled');
						}else{

							/*
							if(animate.startCss[css.fixInline('transform')] === movedStyle[css.fixInline('transform')){
								console.log('------ch s------');
								console.log(dom.getComputedStyleDiff(animate.originCss, movedStyle));
								console.log('------ch e------');
								console.log('------animate.startCss------');
								console.log(animate.startCss);
								console.log('------movedStyle------');
								console.log(movedStyle);
								console.log('------movedStyle end------');
							}
							*/

							//in a delay condition then apply startCss
							if(animate.currentTime <= 0){
								animate.setStyleByDiff(element, animate.startCss);
							//apply new style to original
							}else{
								animate.setStyleByDiff(element, movedStyle);
							}
						}

						//Reset Animation
						css.resetAnimation(clone);
						animate.set('target',null);

					//IS_DETECT_START
					}else if(animate.timelineState===Animate.IS_DETECT_START){

						animate.set("startCss", Animate.getCloneStyle(clone)),
						
						console.log(animate.target.id+' > '+JSON.stringify(animate.startCss));
						 
						setTimeout(function(animate) {
							css.resetAnimation(animate), 
							animate.set("target", null)
						}, 1, animate), 
						animate.set("timelineState", 0), 
						dom.dispatchEvent(element, Animate.DETECT_START_CSS, {
							animate : animate,
							node : node
						}, true, true)

					//resumeTimeWith
					}else if(animate.timelineState===Animate.IS_RESUME_TIME){

						animate.set('timelineState',0);
						animate.handlers.resumeTime(animate);

					//Normal
					}else{
						animate.handlers.start(animate);
					}
				});
				dom.addEvent(document, css.fixEvent('animationIteration'), function(oEvent){
					var animate = Registry.getObjectById(oEvent.animationName, 'Animate');
					if(typeof animate === 'undefined'){return;}
					Animate.eventLog(animate, oEvent, 'Iteration');
					animate.handlers.iteration(animate);
					animate.set('iterated',animate.get('iterated')+1);
				});
				dom.addEvent(document, css.fixEvent('animationEnd'), function(oEvent){
					var animate = Registry.getObjectById(oEvent.animationName, 'Animate');
					if(typeof animate === 'undefined'){return;}
					Animate.eventLog(animate, oEvent, 'End');

					//prevent stop event when setTime() is called.
					if(animate.timelineState != Animate.IS_SET_TIME){
						animate.handlers.end(animate);
					}

					//detect end css
					//animate.detectEndCss();

					animate.set('state','stop');
					animate.set('timelineState',0);
					console.log(animate.id+'.state = '+animate.state);

					console.log(animate.id, animate);
				});
			},
			getCloneStyle : function(element){
				console.log('Animate::getCloneStyle('+element.id+')');
				var i, prop, result={},
					styles = window.getComputedStyle(element);

				for(i=0; i<styles.length; i++){
					prop = styles[i];
					if(prop.substr(0,subLen)!==css.fixInline('animation-') && prop !== 'visibility'){
						//console.log(prop, styles[prop]);
						//result[prop] = styles[prop];
						result[prop] = styles.getPropertyValue(prop);
					}
				}
				//compensation
				/*
                if(typeof result['opacity']==='string'){
                    var d = Math.abs(1-parseFloat(result['opacity']));
                    //assume over 0.98 is 1
                    if(d < 0.02){
                        result['opacity'] = 1;
                    }
                }
                */
                if(typeof result[css.fixInline('transform')]==='string'){
                    if(result[css.fixInline('transform')]==='matrix(1, 0, 0, 1, 0, 0)'){
                        result[css.fixInline('transform')] = 'none';
                    }
                }
				//QT Bug
                if(env.agent==='qt'){
                	if(result['clip'] == 'rect(0px 0px 0px 0px)'){
                		result['clip'] = 'auto';
                	}
                }
				//WebKit Bug
				result['kerning'] = parseInt(result['kerning'])+'px';
				result['stroke-dashoffset'] = parseInt(result['stroke-dashoffset'])+'px';
				result['stroke-width'] = parseInt(result['stroke-width'])+'px';
				//Fix
				if(result['z-index']==='auto'){
					result['z-index'] = '0';
				}
				return result;
			}
		}
	});

	//move to start pos
	dom.addEvent(document, Animate.DETECT_START_CSS, function(oEvent){
		logger.event(Animate.DETECT_START_CSS);
		var node = oEvent.bundle.node,
			animate = oEvent.bundle.animate;
		animate.goToStartFrameWith(node);
	});

	Animate.addAniEvent();

	module.exports = Animate;
});