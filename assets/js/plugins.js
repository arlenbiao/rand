/*!
 * perfect-scrollbar v1.4.0
 * (c) 2018 Hyunje Jun
 * @license MIT
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global.PerfectScrollbar = factory());
}(this, (function () { 'use strict';

    function get(element) {
        return getComputedStyle(element);
    }

    function set(element, obj) {
        for (var key in obj) {
            var val = obj[key];
            if (typeof val === 'number') {
                val = val + "px";
            }
            element.style[key] = val;
        }
        return element;
    }

    function div(className) {
        var div = document.createElement('div');
        div.className = className;
        return div;
    }

    var elMatches =
        typeof Element !== 'undefined' &&
        (Element.prototype.matches ||
            Element.prototype.webkitMatchesSelector ||
            Element.prototype.mozMatchesSelector ||
            Element.prototype.msMatchesSelector);

    function matches(element, query) {
        if (!elMatches) {
            throw new Error('No element matching method supported');
        }

        return elMatches.call(element, query);
    }

    function remove(element) {
        if (element.remove) {
            element.remove();
        } else {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
    }

    function queryChildren(element, selector) {
        return Array.prototype.filter.call(element.children, function (child) { return matches(child, selector); }
        );
    }

    var cls = {
        main: 'ps',
        element: {
            thumb: function (x) { return ("ps__thumb-" + x); },
            rail: function (x) { return ("ps__rail-" + x); },
            consuming: 'ps__child--consume',
        },
        state: {
            focus: 'ps--focus',
            clicking: 'ps--clicking',
            active: function (x) { return ("ps--active-" + x); },
            scrolling: function (x) { return ("ps--scrolling-" + x); },
        },
    };

    /*
     * Helper methods
     */
    var scrollingClassTimeout = { x: null, y: null };

    function addScrollingClass(i, x) {
        var classList = i.element.classList;
        var className = cls.state.scrolling(x);

        if (classList.contains(className)) {
            clearTimeout(scrollingClassTimeout[x]);
        } else {
            classList.add(className);
        }
    }

    function removeScrollingClass(i, x) {
        scrollingClassTimeout[x] = setTimeout(
            function () { return i.isAlive && i.element.classList.remove(cls.state.scrolling(x)); },
            i.settings.scrollingThreshold
        );
    }

    function setScrollingClassInstantly(i, x) {
        addScrollingClass(i, x);
        removeScrollingClass(i, x);
    }

    var EventElement = function EventElement(element) {
        this.element = element;
        this.handlers = {};
    };

    var prototypeAccessors = { isEmpty: { configurable: true } };

    EventElement.prototype.bind = function bind (eventName, handler) {
        if (typeof this.handlers[eventName] === 'undefined') {
            this.handlers[eventName] = [];
        }
        this.handlers[eventName].push(handler);
        this.element.addEventListener(eventName, handler, false);
    };

    EventElement.prototype.unbind = function unbind (eventName, target) {
        var this$1 = this;

        this.handlers[eventName] = this.handlers[eventName].filter(function (handler) {
            if (target && handler !== target) {
                return true;
            }
            this$1.element.removeEventListener(eventName, handler, false);
            return false;
        });
    };

    EventElement.prototype.unbindAll = function unbindAll () {
        var this$1 = this;

        for (var name in this$1.handlers) {
            this$1.unbind(name);
        }
    };

    prototypeAccessors.isEmpty.get = function () {
        var this$1 = this;

        return Object.keys(this.handlers).every(
            function (key) { return this$1.handlers[key].length === 0; }
        );
    };

    Object.defineProperties( EventElement.prototype, prototypeAccessors );

    var EventManager = function EventManager() {
        this.eventElements = [];
    };

    EventManager.prototype.eventElement = function eventElement (element) {
        var ee = this.eventElements.filter(function (ee) { return ee.element === element; })[0];
        if (!ee) {
            ee = new EventElement(element);
            this.eventElements.push(ee);
        }
        return ee;
    };

    EventManager.prototype.bind = function bind (element, eventName, handler) {
        this.eventElement(element).bind(eventName, handler);
    };

    EventManager.prototype.unbind = function unbind (element, eventName, handler) {
        var ee = this.eventElement(element);
        ee.unbind(eventName, handler);

        if (ee.isEmpty) {
            // remove
            this.eventElements.splice(this.eventElements.indexOf(ee), 1);
        }
    };

    EventManager.prototype.unbindAll = function unbindAll () {
        this.eventElements.forEach(function (e) { return e.unbindAll(); });
        this.eventElements = [];
    };

    EventManager.prototype.once = function once (element, eventName, handler) {
        var ee = this.eventElement(element);
        var onceHandler = function (evt) {
            ee.unbind(eventName, onceHandler);
            handler(evt);
        };
        ee.bind(eventName, onceHandler);
    };

    function createEvent(name) {
        if (typeof window.CustomEvent === 'function') {
            return new CustomEvent(name);
        } else {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(name, false, false, undefined);
            return evt;
        }
    }

    var processScrollDiff = function(
        i,
        axis,
        diff,
        useScrollingClass,
        forceFireReachEvent
    ) {
        if ( useScrollingClass === void 0 ) useScrollingClass = true;
        if ( forceFireReachEvent === void 0 ) forceFireReachEvent = false;

        var fields;
        if (axis === 'top') {
            fields = [
                'contentHeight',
                'containerHeight',
                'scrollTop',
                'y',
                'up',
                'down' ];
        } else if (axis === 'left') {
            fields = [
                'contentWidth',
                'containerWidth',
                'scrollLeft',
                'x',
                'left',
                'right' ];
        } else {
            throw new Error('A proper axis should be provided');
        }

        processScrollDiff$1(i, diff, fields, useScrollingClass, forceFireReachEvent);
    };

    function processScrollDiff$1(
        i,
        diff,
        ref,
        useScrollingClass,
        forceFireReachEvent
    ) {
        var contentHeight = ref[0];
        var containerHeight = ref[1];
        var scrollTop = ref[2];
        var y = ref[3];
        var up = ref[4];
        var down = ref[5];
        if ( useScrollingClass === void 0 ) useScrollingClass = true;
        if ( forceFireReachEvent === void 0 ) forceFireReachEvent = false;

        var element = i.element;

        // reset reach
        i.reach[y] = null;

        // 1 for subpixel rounding
        if (element[scrollTop] < 1) {
            i.reach[y] = 'start';
        }

        // 1 for subpixel rounding
        if (element[scrollTop] > i[contentHeight] - i[containerHeight] - 1) {
            i.reach[y] = 'end';
        }

        if (diff) {
            element.dispatchEvent(createEvent(("ps-scroll-" + y)));

            if (diff < 0) {
                element.dispatchEvent(createEvent(("ps-scroll-" + up)));
            } else if (diff > 0) {
                element.dispatchEvent(createEvent(("ps-scroll-" + down)));
            }

            if (useScrollingClass) {
                setScrollingClassInstantly(i, y);
            }
        }

        if (i.reach[y] && (diff || forceFireReachEvent)) {
            element.dispatchEvent(createEvent(("ps-" + y + "-reach-" + (i.reach[y]))));
        }
    }

    function toInt(x) {
        return parseInt(x, 10) || 0;
    }

    function isEditable(el) {
        return (
            matches(el, 'input,[contenteditable]') ||
            matches(el, 'select,[contenteditable]') ||
            matches(el, 'textarea,[contenteditable]') ||
            matches(el, 'button,[contenteditable]')
        );
    }

    function outerWidth(element) {
        var styles = get(element);
        return (
            toInt(styles.width) +
            toInt(styles.paddingLeft) +
            toInt(styles.paddingRight) +
            toInt(styles.borderLeftWidth) +
            toInt(styles.borderRightWidth)
        );
    }

    var env = {
        isWebKit:
            typeof document !== 'undefined' &&
            'WebkitAppearance' in document.documentElement.style,
        supportsTouch:
            typeof window !== 'undefined' &&
            ('ontouchstart' in window ||
                (window.DocumentTouch && document instanceof window.DocumentTouch)),
        supportsIePointer:
            typeof navigator !== 'undefined' && navigator.msMaxTouchPoints,
        isChrome:
            typeof navigator !== 'undefined' &&
            /Chrome/i.test(navigator && navigator.userAgent),
    };

    var updateGeometry = function(i) {
        var element = i.element;
        var roundedScrollTop = Math.floor(element.scrollTop);

        i.containerWidth = element.clientWidth;
        i.containerHeight = element.clientHeight - 40;
        i.contentWidth = element.scrollWidth;
        i.contentHeight = element.scrollHeight - 40;

        if (!element.contains(i.scrollbarXRail)) {
            // clean up and append
            queryChildren(element, cls.element.rail('x')).forEach(function (el) { return remove(el); }
            );
            element.appendChild(i.scrollbarXRail);
        }
        if (!element.contains(i.scrollbarYRail)) {
            // clean up and append
            queryChildren(element, cls.element.rail('y')).forEach(function (el) { return remove(el); }
            );
            element.appendChild(i.scrollbarYRail);
        }

        if (
            !i.settings.suppressScrollX &&
            i.containerWidth + i.settings.scrollXMarginOffset < i.contentWidth
        ) {
            i.scrollbarXActive = true;
            i.railXWidth = i.containerWidth - i.railXMarginWidth;
            i.railXRatio = i.containerWidth / i.railXWidth;
            i.scrollbarXWidth = getThumbSize(
                i,
                toInt(i.railXWidth * i.containerWidth / i.contentWidth)
            );
            i.scrollbarXLeft = toInt(
                (i.negativeScrollAdjustment + element.scrollLeft) *
                (i.railXWidth - i.scrollbarXWidth) /
                (i.contentWidth - i.containerWidth)
            );
        } else {
            i.scrollbarXActive = false;
        }

        if (
            !i.settings.suppressScrollY &&
            i.containerHeight + i.settings.scrollYMarginOffset < i.contentHeight
        ) {
            i.scrollbarYActive = true;
            i.railYHeight = i.containerHeight - i.railYMarginHeight;
            i.railYRatio = i.containerHeight / i.railYHeight;
            i.scrollbarYHeight = getThumbSize(
                i,
                toInt(i.railYHeight * i.containerHeight / i.contentHeight)
            );
            i.scrollbarYTop = toInt(
                roundedScrollTop *
                (i.railYHeight - i.scrollbarYHeight) /
                (i.contentHeight - i.containerHeight)
            );
        } else {
            i.scrollbarYActive = false;
        }

        if (i.scrollbarXLeft >= i.railXWidth - i.scrollbarXWidth) {
            i.scrollbarXLeft = i.railXWidth - i.scrollbarXWidth;
        }
        if (i.scrollbarYTop >= i.railYHeight - i.scrollbarYHeight) {
            i.scrollbarYTop = i.railYHeight - i.scrollbarYHeight;
        }

        updateCss(element, i);

        if (i.scrollbarXActive) {
            element.classList.add(cls.state.active('x'));
        } else {
            element.classList.remove(cls.state.active('x'));
            i.scrollbarXWidth = 0;
            i.scrollbarXLeft = 0;
            element.scrollLeft = 0;
        }
        if (i.scrollbarYActive) {
            element.classList.add(cls.state.active('y'));
        } else {
            element.classList.remove(cls.state.active('y'));
            i.scrollbarYHeight = 0;
            i.scrollbarYTop = 0;
            element.scrollTop = 0;
        }
    };

    function getThumbSize(i, thumbSize) {
        if (i.settings.minScrollbarLength) {
            thumbSize = Math.max(thumbSize, i.settings.minScrollbarLength);
        }
        if (i.settings.maxScrollbarLength) {
            thumbSize = Math.min(thumbSize, i.settings.maxScrollbarLength);
        }
        return thumbSize;
    }

    function updateCss(element, i) {
        var xRailOffset = { width: i.railXWidth };
        var roundedScrollTop = Math.floor(element.scrollTop);

        if (i.isRtl) {
            xRailOffset.left =
                i.negativeScrollAdjustment +
                element.scrollLeft +
                i.containerWidth -
                i.contentWidth;
        } else {
            xRailOffset.left = element.scrollLeft;
        }
        if (i.isScrollbarXUsingBottom) {
            xRailOffset.bottom = i.scrollbarXBottom - roundedScrollTop;
        } else {
            xRailOffset.top = i.scrollbarXTop + roundedScrollTop;
        }
        set(i.scrollbarXRail, xRailOffset);

        var yRailOffset = { top: roundedScrollTop, height: i.railYHeight };
        if (i.isScrollbarYUsingRight) {
            if (i.isRtl) {
                yRailOffset.right =
                    i.contentWidth -
                    (i.negativeScrollAdjustment + element.scrollLeft) -
                    i.scrollbarYRight -
                    i.scrollbarYOuterWidth;
            } else {
                yRailOffset.right = i.scrollbarYRight - element.scrollLeft;
            }
        } else {
            if (i.isRtl) {
                yRailOffset.left =
                    i.negativeScrollAdjustment +
                    element.scrollLeft +
                    i.containerWidth * 2 -
                    i.contentWidth -
                    i.scrollbarYLeft -
                    i.scrollbarYOuterWidth;
            } else {
                yRailOffset.left = i.scrollbarYLeft + element.scrollLeft;
            }
        }
        set(i.scrollbarYRail, yRailOffset);

        set(i.scrollbarX, {
            left: i.scrollbarXLeft,
            width: i.scrollbarXWidth - i.railBorderXWidth,
        });
        set(i.scrollbarY, {
            top: i.scrollbarYTop,
            height: i.scrollbarYHeight - i.railBorderYWidth,
        });
    }

    var clickRail = function(i) {
        i.event.bind(i.scrollbarY, 'mousedown', function (e) { return e.stopPropagation(); });
        i.event.bind(i.scrollbarYRail, 'mousedown', function (e) {
            var positionTop =
                e.pageY -
                window.pageYOffset -
                i.scrollbarYRail.getBoundingClientRect().top;
            var direction = positionTop > i.scrollbarYTop ? 1 : -1;

            i.element.scrollTop += direction * i.containerHeight;
            updateGeometry(i);

            e.stopPropagation();
        });

        i.event.bind(i.scrollbarX, 'mousedown', function (e) { return e.stopPropagation(); });
        i.event.bind(i.scrollbarXRail, 'mousedown', function (e) {
            var positionLeft =
                e.pageX -
                window.pageXOffset -
                i.scrollbarXRail.getBoundingClientRect().left;
            var direction = positionLeft > i.scrollbarXLeft ? 1 : -1;

            i.element.scrollLeft += direction * i.containerWidth;
            updateGeometry(i);

            e.stopPropagation();
        });
    };

    var dragThumb = function(i) {
        bindMouseScrollHandler(i, [
            'containerWidth',
            'contentWidth',
            'pageX',
            'railXWidth',
            'scrollbarX',
            'scrollbarXWidth',
            'scrollLeft',
            'x',
            'scrollbarXRail' ]);
        bindMouseScrollHandler(i, [
            'containerHeight',
            'contentHeight',
            'pageY',
            'railYHeight',
            'scrollbarY',
            'scrollbarYHeight',
            'scrollTop',
            'y',
            'scrollbarYRail' ]);
    };

    function bindMouseScrollHandler(
        i,
        ref
    ) {
        var containerHeight = ref[0];
        var contentHeight = ref[1];
        var pageY = ref[2];
        var railYHeight = ref[3];
        var scrollbarY = ref[4];
        var scrollbarYHeight = ref[5];
        var scrollTop = ref[6];
        var y = ref[7];
        var scrollbarYRail = ref[8];

        var element = i.element;

        var startingScrollTop = null;
        var startingMousePageY = null;
        var scrollBy = null;

        function mouseMoveHandler(e) {
            element[scrollTop] =
                startingScrollTop + scrollBy * (e[pageY] - startingMousePageY);
            addScrollingClass(i, y);
            updateGeometry(i);

            e.stopPropagation();
            e.preventDefault();
        }

        function mouseUpHandler() {
            removeScrollingClass(i, y);
            i[scrollbarYRail].classList.remove(cls.state.clicking);
            i.event.unbind(i.ownerDocument, 'mousemove', mouseMoveHandler);
        }

        i.event.bind(i[scrollbarY], 'mousedown', function (e) {
            startingScrollTop = element[scrollTop];
            startingMousePageY = e[pageY];
            scrollBy =
                (i[contentHeight] - i[containerHeight]) /
                (i[railYHeight] - i[scrollbarYHeight]);

            i.event.bind(i.ownerDocument, 'mousemove', mouseMoveHandler);
            i.event.once(i.ownerDocument, 'mouseup', mouseUpHandler);

            i[scrollbarYRail].classList.add(cls.state.clicking);

            e.stopPropagation();
            e.preventDefault();
        });
    }

    var keyboard = function(i) {
        var element = i.element;

        var elementHovered = function () { return matches(element, ':hover'); };
        var scrollbarFocused = function () { return matches(i.scrollbarX, ':focus') || matches(i.scrollbarY, ':focus'); };

        function shouldPreventDefault(deltaX, deltaY) {
            var scrollTop = Math.floor(element.scrollTop);
            if (deltaX === 0) {
                if (!i.scrollbarYActive) {
                    return false;
                }
                if (
                    (scrollTop === 0 && deltaY > 0) ||
                    (scrollTop >= i.contentHeight - i.containerHeight && deltaY < 0)
                ) {
                    return !i.settings.wheelPropagation;
                }
            }

            var scrollLeft = element.scrollLeft;
            if (deltaY === 0) {
                if (!i.scrollbarXActive) {
                    return false;
                }
                if (
                    (scrollLeft === 0 && deltaX < 0) ||
                    (scrollLeft >= i.contentWidth - i.containerWidth && deltaX > 0)
                ) {
                    return !i.settings.wheelPropagation;
                }
            }
            return true;
        }

        i.event.bind(i.ownerDocument, 'keydown', function (e) {
            if (
                (e.isDefaultPrevented && e.isDefaultPrevented()) ||
                e.defaultPrevented
            ) {
                return;
            }

            if (!elementHovered() && !scrollbarFocused()) {
                return;
            }

            var activeElement = document.activeElement
                ? document.activeElement
                : i.ownerDocument.activeElement;
            if (activeElement) {
                if (activeElement.tagName === 'IFRAME') {
                    activeElement = activeElement.contentDocument.activeElement;
                } else {
                    // go deeper if element is a webcomponent
                    while (activeElement.shadowRoot) {
                        activeElement = activeElement.shadowRoot.activeElement;
                    }
                }
                if (isEditable(activeElement)) {
                    return;
                }
            }

            var deltaX = 0;
            var deltaY = 0;

            switch (e.which) {
                case 37: // left
                    if (e.metaKey) {
                        deltaX = -i.contentWidth;
                    } else if (e.altKey) {
                        deltaX = -i.containerWidth;
                    } else {
                        deltaX = -30;
                    }
                    break;
                case 38: // up
                    if (e.metaKey) {
                        deltaY = i.contentHeight;
                    } else if (e.altKey) {
                        deltaY = i.containerHeight;
                    } else {
                        deltaY = 30;
                    }
                    break;
                case 39: // right
                    if (e.metaKey) {
                        deltaX = i.contentWidth;
                    } else if (e.altKey) {
                        deltaX = i.containerWidth;
                    } else {
                        deltaX = 30;
                    }
                    break;
                case 40: // down
                    if (e.metaKey) {
                        deltaY = -i.contentHeight;
                    } else if (e.altKey) {
                        deltaY = -i.containerHeight;
                    } else {
                        deltaY = -30;
                    }
                    break;
                case 32: // space bar
                    if (e.shiftKey) {
                        deltaY = i.containerHeight;
                    } else {
                        deltaY = -i.containerHeight;
                    }
                    break;
                case 33: // page up
                    deltaY = i.containerHeight;
                    break;
                case 34: // page down
                    deltaY = -i.containerHeight;
                    break;
                case 36: // home
                    deltaY = i.contentHeight;
                    break;
                case 35: // end
                    deltaY = -i.contentHeight;
                    break;
                default:
                    return;
            }

            if (i.settings.suppressScrollX && deltaX !== 0) {
                return;
            }
            if (i.settings.suppressScrollY && deltaY !== 0) {
                return;
            }

            element.scrollTop -= deltaY;
            element.scrollLeft += deltaX;
            updateGeometry(i);

            if (shouldPreventDefault(deltaX, deltaY)) {
                e.preventDefault();
            }
        });
    };

    var wheel = function(i) {
        var element = i.element;

        function shouldPreventDefault(deltaX, deltaY) {
            var roundedScrollTop = Math.floor(element.scrollTop);
            var isTop = element.scrollTop === 0;
            var isBottom =
                roundedScrollTop + element.offsetHeight === element.scrollHeight;
            var isLeft = element.scrollLeft === 0;
            var isRight =
                element.scrollLeft + element.offsetWidth === element.scrollWidth;

            var hitsBound;

            // pick axis with primary direction
            if (Math.abs(deltaY) > Math.abs(deltaX)) {
                hitsBound = isTop || isBottom;
            } else {
                hitsBound = isLeft || isRight;
            }

            return hitsBound ? !i.settings.wheelPropagation : true;
        }

        function getDeltaFromEvent(e) {
            var deltaX = e.deltaX;
            var deltaY = -1 * e.deltaY;

            if (typeof deltaX === 'undefined' || typeof deltaY === 'undefined') {
                // OS X Safari
                deltaX = -1 * e.wheelDeltaX / 6;
                deltaY = e.wheelDeltaY / 6;
            }

            if (e.deltaMode && e.deltaMode === 1) {
                // Firefox in deltaMode 1: Line scrolling
                deltaX *= 10;
                deltaY *= 10;
            }

            if (deltaX !== deltaX && deltaY !== deltaY /* NaN checks */) {
                // IE in some mouse drivers
                deltaX = 0;
                deltaY = e.wheelDelta;
            }

            if (e.shiftKey) {
                // reverse axis with shift key
                return [-deltaY, -deltaX];
            }
            return [deltaX, deltaY];
        }

        function shouldBeConsumedByChild(target, deltaX, deltaY) {
            // FIXME: this is a workaround for <select> issue in FF and IE #571
            if (!env.isWebKit && element.querySelector('select:focus')) {
                return true;
            }

            if (!element.contains(target)) {
                return false;
            }

            var cursor = target;

            while (cursor && cursor !== element) {
                if (cursor.classList.contains(cls.element.consuming)) {
                    return true;
                }

                var style = get(cursor);
                var overflow = [style.overflow, style.overflowX, style.overflowY].join(
                    ''
                );

                // if scrollable
                if (overflow.match(/(scroll|auto)/)) {
                    var maxScrollTop = cursor.scrollHeight - cursor.clientHeight;
                    if (maxScrollTop > 0) {
                        if (
                            !(cursor.scrollTop === 0 && deltaY > 0) &&
                            !(cursor.scrollTop === maxScrollTop && deltaY < 0)
                        ) {
                            return true;
                        }
                    }
                    var maxScrollLeft = cursor.scrollWidth - cursor.clientWidth;
                    if (maxScrollLeft > 0) {
                        if (
                            !(cursor.scrollLeft === 0 && deltaX < 0) &&
                            !(cursor.scrollLeft === maxScrollLeft && deltaX > 0)
                        ) {
                            return true;
                        }
                    }
                }

                cursor = cursor.parentNode;
            }

            return false;
        }

        function mousewheelHandler(e) {
            var ref = getDeltaFromEvent(e);
            var deltaX = ref[0];
            var deltaY = ref[1];

            if (shouldBeConsumedByChild(e.target, deltaX, deltaY)) {
                return;
            }

            var shouldPrevent = false;
            if (!i.settings.useBothWheelAxes) {
                // deltaX will only be used for horizontal scrolling and deltaY will
                // only be used for vertical scrolling - this is the default
                element.scrollTop -= deltaY * i.settings.wheelSpeed;
                element.scrollLeft += deltaX * i.settings.wheelSpeed;
            } else if (i.scrollbarYActive && !i.scrollbarXActive) {
                // only vertical scrollbar is active and useBothWheelAxes option is
                // active, so let's scroll vertical bar using both mouse wheel axes
                if (deltaY) {
                    element.scrollTop -= deltaY * i.settings.wheelSpeed;
                } else {
                    element.scrollTop += deltaX * i.settings.wheelSpeed;
                }
                shouldPrevent = true;
            } else if (i.scrollbarXActive && !i.scrollbarYActive) {
                // useBothWheelAxes and only horizontal bar is active, so use both
                // wheel axes for horizontal bar
                if (deltaX) {
                    element.scrollLeft += deltaX * i.settings.wheelSpeed;
                } else {
                    element.scrollLeft -= deltaY * i.settings.wheelSpeed;
                }
                shouldPrevent = true;
            }

            updateGeometry(i);

            shouldPrevent = shouldPrevent || shouldPreventDefault(deltaX, deltaY);
            if (shouldPrevent && !e.ctrlKey) {
                e.stopPropagation();
                // e.preventDefault(), { passive: false };
            }
        }

        if (typeof window.onwheel !== 'undefined') {
            i.event.bind(element, 'wheel', mousewheelHandler);
        } else if (typeof window.onmousewheel !== 'undefined') {
            i.event.bind(element, 'mousewheel', mousewheelHandler);
        }
    };

    var touch = function(i) {
        if (!env.supportsTouch && !env.supportsIePointer) {
            return;
        }

        var element = i.element;

        function shouldPrevent(deltaX, deltaY) {
            var scrollTop = Math.floor(element.scrollTop);
            var scrollLeft = element.scrollLeft;
            var magnitudeX = Math.abs(deltaX);
            var magnitudeY = Math.abs(deltaY);

            if (magnitudeY > magnitudeX) {
                // user is perhaps trying to swipe up/down the page

                if (
                    (deltaY < 0 && scrollTop === i.contentHeight - i.containerHeight) ||
                    (deltaY > 0 && scrollTop === 0)
                ) {
                    // set prevent for mobile Chrome refresh
                    return window.scrollY === 0 && deltaY > 0 && env.isChrome;
                }
            } else if (magnitudeX > magnitudeY) {
                // user is perhaps trying to swipe left/right across the page

                if (
                    (deltaX < 0 && scrollLeft === i.contentWidth - i.containerWidth) ||
                    (deltaX > 0 && scrollLeft === 0)
                ) {
                    return true;
                }
            }

            return true;
        }

        function applyTouchMove(differenceX, differenceY) {
            element.scrollTop -= differenceY;
            element.scrollLeft -= differenceX;

            updateGeometry(i);
        }

        var startOffset = {};
        var startTime = 0;
        var speed = {};
        var easingLoop = null;

        function getTouch(e) {
            if (e.targetTouches) {
                return e.targetTouches[0];
            } else {
                // Maybe IE pointer
                return e;
            }
        }

        function shouldHandle(e) {
            if (e.pointerType && e.pointerType === 'pen' && e.buttons === 0) {
                return false;
            }
            if (e.targetTouches && e.targetTouches.length === 1) {
                return true;
            }
            if (
                e.pointerType &&
                e.pointerType !== 'mouse' &&
                e.pointerType !== e.MSPOINTER_TYPE_MOUSE
            ) {
                return true;
            }
            return false;
        }

        function touchStart(e) {
            if (!shouldHandle(e)) {
                return;
            }

            var touch = getTouch(e);

            startOffset.pageX = touch.pageX;
            startOffset.pageY = touch.pageY;

            startTime = new Date().getTime();

            if (easingLoop !== null) {
                clearInterval(easingLoop);
            }
        }

        function shouldBeConsumedByChild(target, deltaX, deltaY) {
            if (!element.contains(target)) {
                return false;
            }

            var cursor = target;

            while (cursor && cursor !== element) {
                if (cursor.classList.contains(cls.element.consuming)) {
                    return true;
                }

                var style = get(cursor);
                var overflow = [style.overflow, style.overflowX, style.overflowY].join(
                    ''
                );

                // if scrollable
                if (overflow.match(/(scroll|auto)/)) {
                    var maxScrollTop = cursor.scrollHeight - cursor.clientHeight;
                    if (maxScrollTop > 0) {
                        if (
                            !(cursor.scrollTop === 0 && deltaY > 0) &&
                            !(cursor.scrollTop === maxScrollTop && deltaY < 0)
                        ) {
                            return true;
                        }
                    }
                    var maxScrollLeft = cursor.scrollLeft - cursor.clientWidth;
                    if (maxScrollLeft > 0) {
                        if (
                            !(cursor.scrollLeft === 0 && deltaX < 0) &&
                            !(cursor.scrollLeft === maxScrollLeft && deltaX > 0)
                        ) {
                            return true;
                        }
                    }
                }

                cursor = cursor.parentNode;
            }

            return false;
        }

        function touchMove(e) {
            if (shouldHandle(e)) {
                var touch = getTouch(e);

                var currentOffset = { pageX: touch.pageX, pageY: touch.pageY };

                var differenceX = currentOffset.pageX - startOffset.pageX;
                var differenceY = currentOffset.pageY - startOffset.pageY;

                if (shouldBeConsumedByChild(e.target, differenceX, differenceY)) {
                    return;
                }

                applyTouchMove(differenceX, differenceY);
                startOffset = currentOffset;

                var currentTime = new Date().getTime();

                var timeGap = currentTime - startTime;
                if (timeGap > 0) {
                    speed.x = differenceX / timeGap;
                    speed.y = differenceY / timeGap;
                    startTime = currentTime;
                }

                if (shouldPrevent(differenceX, differenceY)) {
                    e.preventDefault();
                }
            }
        }
        function touchEnd() {
            if (i.settings.swipeEasing) {
                clearInterval(easingLoop);
                easingLoop = setInterval(function() {
                    if (i.isInitialized) {
                        clearInterval(easingLoop);
                        return;
                    }

                    if (!speed.x && !speed.y) {
                        clearInterval(easingLoop);
                        return;
                    }

                    if (Math.abs(speed.x) < 0.01 && Math.abs(speed.y) < 0.01) {
                        clearInterval(easingLoop);
                        return;
                    }

                    applyTouchMove(speed.x * 30, speed.y * 30);

                    speed.x *= 0.8;
                    speed.y *= 0.8;
                }, 10);
            }
        }

        if (env.supportsTouch) {
            i.event.bind(element, 'touchstart', touchStart);
            i.event.bind(element, 'touchmove', touchMove);
            i.event.bind(element, 'touchend', touchEnd);
        } else if (env.supportsIePointer) {
            if (window.PointerEvent) {
                i.event.bind(element, 'pointerdown', touchStart);
                i.event.bind(element, 'pointermove', touchMove);
                i.event.bind(element, 'pointerup', touchEnd);
            } else if (window.MSPointerEvent) {
                i.event.bind(element, 'MSPointerDown', touchStart);
                i.event.bind(element, 'MSPointerMove', touchMove);
                i.event.bind(element, 'MSPointerUp', touchEnd);
            }
        }
    };

    var defaultSettings = function () { return ({
        handlers: ['click-rail', 'drag-thumb', 'keyboard', 'wheel', 'touch'],
        maxScrollbarLength: null,
        minScrollbarLength: null,
        scrollingThreshold: 1000,
        scrollXMarginOffset: 0,
        scrollYMarginOffset: 0,
        suppressScrollX: false,
        suppressScrollY: false,
        swipeEasing: true,
        useBothWheelAxes: false,
        wheelPropagation: true,
        wheelSpeed: 1,
    }); };

    var handlers = {
        'click-rail': clickRail,
        'drag-thumb': dragThumb,
        keyboard: keyboard,
        wheel: wheel,
        touch: touch,
    };

    var PerfectScrollbar = function PerfectScrollbar(element, userSettings) {
        var this$1 = this;
        if ( userSettings === void 0 ) userSettings = {};

        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        if (!element || !element.nodeName) {
            throw new Error('no element is specified to initialize PerfectScrollbar');
        }

        this.element = element;

        element.classList.add(cls.main);

        this.settings = defaultSettings();
        for (var key in userSettings) {
            this$1.settings[key] = userSettings[key];
        }

        this.containerWidth = null;
        this.containerHeight = null;
        this.contentWidth = null;
        this.contentHeight = null;

        var focus = function () { return element.classList.add(cls.state.focus); };
        var blur = function () { return element.classList.remove(cls.state.focus); };

        this.isRtl = get(element).direction === 'rtl';
        this.isNegativeScroll = (function () {
            var originalScrollLeft = element.scrollLeft;
            var result = null;
            element.scrollLeft = -1;
            result = element.scrollLeft < 0;
            element.scrollLeft = originalScrollLeft;
            return result;
        })();
        this.negativeScrollAdjustment = this.isNegativeScroll
            ? element.scrollWidth - element.clientWidth
            : 0;
        this.event = new EventManager();
        this.ownerDocument = element.ownerDocument || document;

        this.scrollbarXRail = div(cls.element.rail('x'));
        element.appendChild(this.scrollbarXRail);
        this.scrollbarX = div(cls.element.thumb('x'));
        this.scrollbarXRail.appendChild(this.scrollbarX);
        this.scrollbarX.setAttribute('tabindex', 0);
        this.event.bind(this.scrollbarX, 'focus', focus);
        this.event.bind(this.scrollbarX, 'blur', blur);
        this.scrollbarXActive = null;
        this.scrollbarXWidth = null;
        this.scrollbarXLeft = null;
        var railXStyle = get(this.scrollbarXRail);
        this.scrollbarXBottom = parseInt(railXStyle.bottom, 10);
        if (isNaN(this.scrollbarXBottom)) {
            this.isScrollbarXUsingBottom = false;
            this.scrollbarXTop = toInt(railXStyle.top);
        } else {
            this.isScrollbarXUsingBottom = true;
        }
        this.railBorderXWidth =
            toInt(railXStyle.borderLeftWidth) + toInt(railXStyle.borderRightWidth);
        // Set rail to display:block to calculate margins
        set(this.scrollbarXRail, { display: 'block' });
        this.railXMarginWidth =
            toInt(railXStyle.marginLeft) + toInt(railXStyle.marginRight);
        set(this.scrollbarXRail, { display: '' });
        this.railXWidth = null;
        this.railXRatio = null;

        this.scrollbarYRail = div(cls.element.rail('y'));
        element.appendChild(this.scrollbarYRail);
        this.scrollbarY = div(cls.element.thumb('y'));
        this.scrollbarYRail.appendChild(this.scrollbarY);
        this.scrollbarY.setAttribute('tabindex', 0);
        this.event.bind(this.scrollbarY, 'focus', focus);
        this.event.bind(this.scrollbarY, 'blur', blur);
        this.scrollbarYActive = null;
        this.scrollbarYHeight = null;
        this.scrollbarYTop = null;
        var railYStyle = get(this.scrollbarYRail);
        this.scrollbarYRight = parseInt(railYStyle.right, 10);
        if (isNaN(this.scrollbarYRight)) {
            this.isScrollbarYUsingRight = false;
            this.scrollbarYLeft = toInt(railYStyle.left);
        } else {
            this.isScrollbarYUsingRight = true;
        }
        this.scrollbarYOuterWidth = this.isRtl ? outerWidth(this.scrollbarY) : null;
        this.railBorderYWidth =
            toInt(railYStyle.borderTopWidth) + toInt(railYStyle.borderBottomWidth);
        set(this.scrollbarYRail, { display: 'block' });
        this.railYMarginHeight =
            toInt(railYStyle.marginTop) + toInt(railYStyle.marginBottom);
        set(this.scrollbarYRail, { display: '' });
        this.railYHeight = null;
        this.railYRatio = null;

        this.reach = {
            x:
                element.scrollLeft <= 0
                    ? 'start'
                    : element.scrollLeft >= this.contentWidth - this.containerWidth
                    ? 'end'
                    : null,
            y:
                element.scrollTop <= 0
                    ? 'start'
                    : element.scrollTop >= this.contentHeight - this.containerHeight
                    ? 'end'
                    : null,
        };

        this.isAlive = true;

        this.settings.handlers.forEach(function (handlerName) { return handlers[handlerName](this$1); });

        this.lastScrollTop = Math.floor(element.scrollTop); // for onScroll only
        this.lastScrollLeft = element.scrollLeft; // for onScroll only
        this.event.bind(this.element, 'scroll', function (e) { return this$1.onScroll(e); });
        updateGeometry(this);
    };

    PerfectScrollbar.prototype.update = function update () {
        if (!this.isAlive) {
            return;
        }

        // Recalcuate negative scrollLeft adjustment
        this.negativeScrollAdjustment = this.isNegativeScroll
            ? this.element.scrollWidth - this.element.clientWidth
            : 0;

        // Recalculate rail margins
        set(this.scrollbarXRail, { display: 'block' });
        set(this.scrollbarYRail, { display: 'block' });
        this.railXMarginWidth =
            toInt(get(this.scrollbarXRail).marginLeft) +
            toInt(get(this.scrollbarXRail).marginRight);
        this.railYMarginHeight =
            toInt(get(this.scrollbarYRail).marginTop) +
            toInt(get(this.scrollbarYRail).marginBottom);

        // Hide scrollbars not to affect scrollWidth and scrollHeight
        set(this.scrollbarXRail, { display: 'none' });
        set(this.scrollbarYRail, { display: 'none' });

        updateGeometry(this);

        processScrollDiff(this, 'top', 0, false, true);
        processScrollDiff(this, 'left', 0, false, true);

        set(this.scrollbarXRail, { display: '' });
        set(this.scrollbarYRail, { display: '' });
    };

    PerfectScrollbar.prototype.onScroll = function onScroll (e) {
        if (!this.isAlive) {
            return;
        }

        updateGeometry(this);
        processScrollDiff(this, 'top', this.element.scrollTop - this.lastScrollTop);
        processScrollDiff(
            this,
            'left',
            this.element.scrollLeft - this.lastScrollLeft
        );

        this.lastScrollTop = Math.floor(this.element.scrollTop);
        this.lastScrollLeft = this.element.scrollLeft;
    };

    PerfectScrollbar.prototype.destroy = function destroy () {
        if (!this.isAlive) {
            return;
        }

        this.event.unbindAll();
        remove(this.scrollbarX);
        remove(this.scrollbarY);
        remove(this.scrollbarXRail);
        remove(this.scrollbarYRail);
        this.removePsClasses();

        // unset elements
        this.element = null;
        this.scrollbarX = null;
        this.scrollbarY = null;
        this.scrollbarXRail = null;
        this.scrollbarYRail = null;

        this.isAlive = false;
    };

    PerfectScrollbar.prototype.removePsClasses = function removePsClasses () {
        this.element.className = this.element.className
            .split(' ')
            .filter(function (name) { return !name.match(/^ps([-_].+|)$/); })
            .join(' ');
    };

    return PerfectScrollbar;

})));

/*!
 * VERSION: 0.8.11
 * DATE: 2018-02-15
 * UPDATES AND DOCS AT: http://greensock.com
 *
 * @license Copyright (c) 2008-2018, GreenSock. All rights reserved.
 * MorphSVGPlugin is a Club GreenSock membership benefit; You must have a valid membership to use
 * this code without violating the terms of use. Visit http://greensock.com/club/ to sign up or get more details.
 * This work is subject to the software agreement that was issued with your membership.
 *
 * @author: Jack Doyle, jack@greensock.com
 */
var _gsScope="undefined"!=typeof module&&module.exports&&"undefined"!=typeof global?global:this||window;(_gsScope._gsQueue||(_gsScope._gsQueue=[])).push(function(){"use strict";var a=Math.PI/180,b=180/Math.PI,c=/[achlmqstvz]|(-?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,d=/(?:(-|-=|\+=)?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,e=/(^[#\.][a-z]|[a-y][a-z])/gi,f=/[achlmqstvz]/gi,g=/[\+\-]?\d*\.?\d+e[\+\-]?\d+/gi,h=_gsScope._gsDefine.globals.TweenLite,i=function(a){_gsScope.console&&console.log(a)},j=function(b,c){var d,e,f,g,h,i,j=Math.ceil(Math.abs(c)/90),k=0,l=[];for(b*=a,c*=a,d=c/j,e=4/3*Math.sin(d/2)/(1+Math.cos(d/2)),i=0;j>i;i++)f=b+i*d,g=Math.cos(f),h=Math.sin(f),l[k++]=g-e*h,l[k++]=h+e*g,f+=d,g=Math.cos(f),h=Math.sin(f),l[k++]=g+e*h,l[k++]=h-e*g,l[k++]=g,l[k++]=h;return l},k=function(c,d,e,f,g,h,i,k,l){if(c!==k||d!==l){e=Math.abs(e),f=Math.abs(f);var m=g%360*a,n=Math.cos(m),o=Math.sin(m),p=(c-k)/2,q=(d-l)/2,r=n*p+o*q,s=-o*p+n*q,t=e*e,u=f*f,v=r*r,w=s*s,x=v/t+w/u;x>1&&(e=Math.sqrt(x)*e,f=Math.sqrt(x)*f,t=e*e,u=f*f);var y=h===i?-1:1,z=(t*u-t*w-u*v)/(t*w+u*v);0>z&&(z=0);var A=y*Math.sqrt(z),B=A*(e*s/f),C=A*-(f*r/e),D=(c+k)/2,E=(d+l)/2,F=D+(n*B-o*C),G=E+(o*B+n*C),H=(r-B)/e,I=(s-C)/f,J=(-r-B)/e,K=(-s-C)/f,L=Math.sqrt(H*H+I*I),M=H;y=0>I?-1:1;var N=y*Math.acos(M/L)*b;L=Math.sqrt((H*H+I*I)*(J*J+K*K)),M=H*J+I*K,y=0>H*K-I*J?-1:1;var O=y*Math.acos(M/L)*b;!i&&O>0?O-=360:i&&0>O&&(O+=360),O%=360,N%=360;var P,Q,R,S=j(N,O),T=n*e,U=o*e,V=o*-f,W=n*f,X=S.length-2;for(P=0;X>P;P+=2)Q=S[P],R=S[P+1],S[P]=Q*T+R*V+F,S[P+1]=Q*U+R*W+G;return S[S.length-2]=k,S[S.length-1]=l,S}},l=function(a){var b,d,e,f,h,j,l,m,n,o,p,q,r,s=(a+"").replace(g,function(a){var b=+a;return 1e-4>b&&b>-1e-4?0:b}).match(c)||[],t=[],u=0,v=0,w=s.length,x=2,y=0;if(!a||!isNaN(s[0])||isNaN(s[1]))return i("ERROR: malformed path data: "+a),t;for(b=0;w>b;b++)if(r=h,isNaN(s[b])?(h=s[b].toUpperCase(),j=h!==s[b]):b--,e=+s[b+1],f=+s[b+2],j&&(e+=u,f+=v),0===b&&(m=e,n=f),"M"===h)l&&l.length<8&&(t.length-=1,x=0),u=m=e,v=n=f,l=[e,f],y+=x,x=2,t.push(l),b+=2,h="L";else if("C"===h)l||(l=[0,0]),l[x++]=e,l[x++]=f,j||(u=v=0),l[x++]=u+1*s[b+3],l[x++]=v+1*s[b+4],l[x++]=u+=1*s[b+5],l[x++]=v+=1*s[b+6],b+=6;else if("S"===h)"C"===r||"S"===r?(o=u-l[x-4],p=v-l[x-3],l[x++]=u+o,l[x++]=v+p):(l[x++]=u,l[x++]=v),l[x++]=e,l[x++]=f,j||(u=v=0),l[x++]=u+=1*s[b+3],l[x++]=v+=1*s[b+4],b+=4;else if("Q"===h)o=e-u,p=f-v,l[x++]=u+2*o/3,l[x++]=v+2*p/3,j||(u=v=0),u+=1*s[b+3],v+=1*s[b+4],o=e-u,p=f-v,l[x++]=u+2*o/3,l[x++]=v+2*p/3,l[x++]=u,l[x++]=v,b+=4;else if("T"===h)o=u-l[x-4],p=v-l[x-3],l[x++]=u+o,l[x++]=v+p,o=u+1.5*o-e,p=v+1.5*p-f,l[x++]=e+2*o/3,l[x++]=f+2*p/3,l[x++]=u=e,l[x++]=v=f,b+=2;else if("H"===h)f=v,l[x++]=u+(e-u)/3,l[x++]=v+(f-v)/3,l[x++]=u+2*(e-u)/3,l[x++]=v+2*(f-v)/3,l[x++]=u=e,l[x++]=f,b+=1;else if("V"===h)f=e,e=u,j&&(f+=v-u),l[x++]=e,l[x++]=v+(f-v)/3,l[x++]=e,l[x++]=v+2*(f-v)/3,l[x++]=e,l[x++]=v=f,b+=1;else if("L"===h||"Z"===h)"Z"===h&&(e=m,f=n,l.closed=!0),("L"===h||Math.abs(u-e)>.5||Math.abs(v-f)>.5)&&(l[x++]=u+(e-u)/3,l[x++]=v+(f-v)/3,l[x++]=u+2*(e-u)/3,l[x++]=v+2*(f-v)/3,l[x++]=e,l[x++]=f,"L"===h&&(b+=2)),u=e,v=f;else if("A"===h){if(q=k(u,v,1*s[b+1],1*s[b+2],1*s[b+3],1*s[b+4],1*s[b+5],(j?u:0)+1*s[b+6],(j?v:0)+1*s[b+7]))for(d=0;d<q.length;d++)l[x++]=q[d];u=l[x-2],v=l[x-1],b+=7}else i("Error: malformed path data: "+a);return t.totalPoints=y+x,t},m=function(a,b){var c,d,e,f,g,h,i,j,k,l,m,n,o,p,q=0,r=.999999,s=a.length,t=b/((s-2)/6);for(o=2;s>o;o+=6)for(q+=t;q>r;)c=a[o-2],d=a[o-1],e=a[o],f=a[o+1],g=a[o+2],h=a[o+3],i=a[o+4],j=a[o+5],p=1/(Math.floor(q)+1),k=c+(e-c)*p,m=e+(g-e)*p,k+=(m-k)*p,m+=(g+(i-g)*p-m)*p,l=d+(f-d)*p,n=f+(h-f)*p,l+=(n-l)*p,n+=(h+(j-h)*p-n)*p,a.splice(o,4,c+(e-c)*p,d+(f-d)*p,k,l,k+(m-k)*p,l+(n-l)*p,m,n,g+(i-g)*p,h+(j-h)*p),o+=6,s+=6,q--;return a},n=function(a){var b,c,d,e,f="",g=a.length,h=100;for(c=0;g>c;c++){for(e=a[c],f+="M"+e[0]+","+e[1]+" C",b=e.length,d=2;b>d;d++)f+=(e[d++]*h|0)/h+","+(e[d++]*h|0)/h+" "+(e[d++]*h|0)/h+","+(e[d++]*h|0)/h+" "+(e[d++]*h|0)/h+","+(e[d]*h|0)/h+" ";e.closed&&(f+="z")}return f},o=function(a){for(var b=[],c=a.length-1,d=0;--c>-1;)b[d++]=a[c],b[d++]=a[c+1],c--;for(c=0;d>c;c++)a[c]=b[c];a.reversed=a.reversed?!1:!0},p=function(a){var b,c=a.length,d=0,e=0;for(b=0;c>b;b++)d+=a[b++],e+=a[b];return[d/(c/2),e/(c/2)]},q=function(a){var b,c,d,e=a.length,f=a[0],g=f,h=a[1],i=h;for(d=6;e>d;d+=6)b=a[d],c=a[d+1],b>f?f=b:g>b&&(g=b),c>h?h=c:i>c&&(i=c);return a.centerX=(f+g)/2,a.centerY=(h+i)/2,a.size=(f-g)*(h-i)},r=function(a){for(var b,c,d,e,f,g=a.length,h=a[0][0],i=h,j=a[0][1],k=j;--g>-1;)for(f=a[g],b=f.length,e=6;b>e;e+=6)c=f[e],d=f[e+1],c>h?h=c:i>c&&(i=c),d>j?j=d:k>d&&(k=d);return a.centerX=(h+i)/2,a.centerY=(j+k)/2,a.size=(h-i)*(j-k)},s=function(a,b){return b.length-a.length},t=function(a,b){var c=a.size||q(a),d=b.size||q(b);return Math.abs(d-c)<(c+d)/20?b.centerX-a.centerX||b.centerY-a.centerY:d-c},u=function(a,b){var c,d,e=a.slice(0),f=a.length,g=f-2;for(b=0|b,c=0;f>c;c++)d=(c+b)%g,a[c++]=e[d],a[c]=e[d+1]},v=function(a,b,c,d,e){var f,g,h,i,j=a.length,k=0,l=j-2;for(c*=6,g=0;j>g;g+=6)f=(g+c)%l,i=a[f]-(b[g]-d),h=a[f+1]-(b[g+1]-e),k+=Math.sqrt(h*h+i*i);return k},w=function(a,b,c){var d,e,f,g=a.length,h=p(a),i=p(b),j=i[0]-h[0],k=i[1]-h[1],l=v(a,b,0,j,k),m=0;for(f=6;g>f;f+=6)e=v(a,b,f/6,j,k),l>e&&(l=e,m=f);if(c)for(d=a.slice(0),o(d),f=6;g>f;f+=6)e=v(d,b,f/6,j,k),l>e&&(l=e,m=-f);return m/6},x=function(a,b,c){for(var d,e,f,g,h,i,j=a.length,k=99999999999,l=0,m=0;--j>-1;)for(d=a[j],i=d.length,h=0;i>h;h+=6)e=d[h]-b,f=d[h+1]-c,g=Math.sqrt(e*e+f*f),k>g&&(k=g,l=d[h],m=d[h+1]);return[l,m]},y=function(a,b,c,d,e,f){var g,h,i,j,k,l=b.length,m=0,n=Math.min(a.size||q(a),b[c].size||q(b[c]))*d,o=999999999999,p=a.centerX+e,r=a.centerY+f;for(h=c;l>h&&(g=b[h].size||q(b[h]),!(n>g));h++)i=b[h].centerX-p,j=b[h].centerY-r,k=Math.sqrt(i*i+j*j),o>k&&(m=h,o=k);return k=b[m],b.splice(m,1),k},z=function(a,b,c,d){var e,f,g,h,j,k,l,n=b.length-a.length,p=n>0?b:a,v=n>0?a:b,z=0,A="complexity"===d?s:t,B="position"===d?0:"number"==typeof d?d:.8,C=v.length,D="object"==typeof c&&c.push?c.slice(0):[c],E="reverse"===D[0]||D[0]<0,F="log"===c;if(v[0]){if(p.length>1&&(a.sort(A),b.sort(A),k=p.size||r(p),k=v.size||r(v),k=p.centerX-v.centerX,l=p.centerY-v.centerY,A===t))for(C=0;C<v.length;C++)p.splice(C,0,y(v[C],p,C,B,k,l));if(n)for(0>n&&(n=-n),p[0].length>v[0].length&&m(v[0],(p[0].length-v[0].length)/6|0),C=v.length;n>z;)h=p[C].size||q(p[C]),g=x(v,p[C].centerX,p[C].centerY),h=g[0],j=g[1],v[C++]=[h,j,h,j,h,j,h,j],v.totalPoints+=8,z++;for(C=0;C<a.length;C++)e=b[C],f=a[C],n=e.length-f.length,0>n?m(e,-n/6|0):n>0&&m(f,n/6|0),E&&!f.reversed&&o(f),c=D[C]||0===D[C]?D[C]:"auto",c&&(f.closed||Math.abs(f[0]-f[f.length-2])<.5&&Math.abs(f[1]-f[f.length-1])<.5?"auto"===c||"log"===c?(D[C]=c=w(f,e,0===C),0>c&&(E=!0,o(f),c=-c),u(f,6*c)):"reverse"!==c&&(C&&0>c&&o(f),u(f,6*(0>c?-c:c))):!E&&("auto"===c&&Math.abs(e[0]-f[0])+Math.abs(e[1]-f[1])+Math.abs(e[e.length-2]-f[f.length-2])+Math.abs(e[e.length-1]-f[f.length-1])>Math.abs(e[0]-f[f.length-2])+Math.abs(e[1]-f[f.length-1])+Math.abs(e[e.length-2]-f[0])+Math.abs(e[e.length-1]-f[1])||c%2)?(o(f),D[C]=-1,E=!0):"auto"===c?D[C]=0:"reverse"===c&&(D[C]=-1),f.closed!==e.closed&&(f.closed=e.closed=!1));return F&&i("shapeIndex:["+D.join(",")+"]"),D}},A=function(a,b,c,d){var e=l(a[0]),f=l(a[1]);z(e,f,b||0===b?b:"auto",c)&&(a[0]=n(e),a[1]=n(f),("log"===d||d===!0)&&i('precompile:["'+a[0]+'","'+a[1]+'"]'))},B=function(a,b,c){return b||c||a||0===a?function(d){A(d,a,b,c)}:A},C=function(a,b){if(!b)return a;var c,e,f,g=a.match(d)||[],h=g.length,i="";for("reverse"===b?(e=h-1,c=-2):(e=(2*(parseInt(b,10)||0)+1+100*h)%h,c=2),f=0;h>f;f+=2)i+=g[e-1]+","+g[e]+" ",e=(e+c)%h;return i},D=function(a,b){var c,d,e,f,g,h,i,j=0,k=parseFloat(a[0]),l=parseFloat(a[1]),m=k+","+l+" ",n=.999999;for(e=a.length,c=.5*b/(.5*e-1),d=0;e-2>d;d+=2){if(j+=c,h=parseFloat(a[d+2]),i=parseFloat(a[d+3]),j>n)for(g=1/(Math.floor(j)+1),f=1;j>n;)m+=(k+(h-k)*g*f).toFixed(2)+","+(l+(i-l)*g*f).toFixed(2)+" ",j--,f++;m+=h+","+i+" ",k=h,l=i}return m},E=function(a){var b=a[0].match(d)||[],c=a[1].match(d)||[],e=c.length-b.length;e>0?a[0]=D(b,e):a[1]=D(c,-e)},F=function(a){return isNaN(a)?E:function(b){E(b),b[1]=C(b[1],parseInt(a,10))}},G=function(a,b){var c,d=_gsScope.document.createElementNS("http://www.w3.org/2000/svg","path"),e=Array.prototype.slice.call(a.attributes),f=e.length;for(b=","+b+",";--f>-1;)c=e[f].nodeName.toLowerCase(),-1===b.indexOf(","+c+",")&&d.setAttributeNS(null,c,e[f].nodeValue);return d},H=function(a,b){var c,e,f,g,h,i,j,k,m,o,p,q,r,s,t,u,v,w,x,y,z,A=a.tagName.toLowerCase(),B=.552284749831;return"path"!==A&&a.getBBox?(i=G(a,"x,y,width,height,cx,cy,rx,ry,r,x1,x2,y1,y2,points"),"rect"===A?(g=+a.getAttribute("rx")||0,h=+a.getAttribute("ry")||0,e=+a.getAttribute("x")||0,f=+a.getAttribute("y")||0,o=(+a.getAttribute("width")||0)-2*g,p=(+a.getAttribute("height")||0)-2*h,g||h?(q=e+g*(1-B),r=e+g,s=r+o,t=s+g*B,u=s+g,v=f+h*(1-B),w=f+h,x=w+p,y=x+h*B,z=x+h,c="M"+u+","+w+" V"+x+" C"+[u,y,t,z,s,z,s-(s-r)/3,z,r+(s-r)/3,z,r,z,q,z,e,y,e,x,e,x-(x-w)/3,e,w+(x-w)/3,e,w,e,v,q,f,r,f,r+(s-r)/3,f,s-(s-r)/3,f,s,f,t,f,u,v,u,w].join(",")+"z"):c="M"+(e+o)+","+f+" v"+p+" h"+-o+" v"+-p+" h"+o+"z"):"circle"===A||"ellipse"===A?("circle"===A?(g=h=+a.getAttribute("r")||0,k=g*B):(g=+a.getAttribute("rx")||0,h=+a.getAttribute("ry")||0,k=h*B),e=+a.getAttribute("cx")||0,f=+a.getAttribute("cy")||0,j=g*B,c="M"+(e+g)+","+f+" C"+[e+g,f+k,e+j,f+h,e,f+h,e-j,f+h,e-g,f+k,e-g,f,e-g,f-k,e-j,f-h,e,f-h,e+j,f-h,e+g,f-k,e+g,f].join(",")+"z"):"line"===A?c=n(l("M"+(a.getAttribute("x1")||0)+","+(a.getAttribute("y1")||0)+" L"+(a.getAttribute("x2")||0)+","+(a.getAttribute("y2")||0))):("polyline"===A||"polygon"===A)&&(m=(a.getAttribute("points")+"").match(d)||[],e=m.shift(),f=m.shift(),c="M"+e+","+f+" L"+m.join(","),"polygon"===A&&(c+=","+e+","+f+"z")),i.setAttribute("d",c),b&&a.parentNode&&(a.parentNode.insertBefore(i,a),a.parentNode.removeChild(a)),i):a},I=function(a,b,c){var f,g,j="string"==typeof a;return(!j||e.test(a)||(a.match(d)||[]).length<3)&&(f=j?h.selector(a):a&&a[0]?a:[a],f&&f[0]?(f=f[0],g=f.nodeName.toUpperCase(),b&&"PATH"!==g&&(f=H(f,!1),g="PATH"),a=f.getAttribute("PATH"===g?"d":"points")||"",f===c&&(a=f.getAttributeNS(null,"data-original")||a)):(i("WARNING: invalid morph to: "+a),a=!1)),a},J="Use MorphSVGPlugin.convertToPath(elementOrSelectorText) to convert to a path before morphing.",K=_gsScope._gsDefine.plugin({propName:"morphSVG",API:2,global:!0,version:"0.8.11",init:function(a,b,c,d){var e,g,h,j,k;return"function"!=typeof a.setAttribute?!1:("function"==typeof b&&(b=b(d,a)),e=a.nodeName.toUpperCase(),k="POLYLINE"===e||"POLYGON"===e,"PATH"===e||k?(g="PATH"===e?"d":"points",("string"==typeof b||b.getBBox||b[0])&&(b={shape:b}),j=I(b.shape||b.d||b.points||"","d"===g,a),k&&f.test(j)?(i("WARNING: a <"+e+"> cannot accept path data. "+J),!1):(j&&(this._target=a,a.getAttributeNS(null,"data-original")||a.setAttributeNS(null,"data-original",a.getAttribute(g)),h=this._addTween(a,"setAttribute",a.getAttribute(g)+"",j+"","morphSVG",!1,g,"object"==typeof b.precompile?function(a){a[0]=b.precompile[0],a[1]=b.precompile[1]}:"d"===g?B(b.shapeIndex,b.map||K.defaultMap,b.precompile):F(b.shapeIndex)),h&&(this._overwriteProps.push("morphSVG"),h.end=j,h.endProp=g)),!0)):(i("WARNING: cannot morph a <"+e+"> SVG element. "+J),!1))},set:function(a){var b;if(this._super.setRatio.call(this,a),1===a)for(b=this._firstPT;b;)b.end&&this._target.setAttribute(b.endProp,b.end),b=b._next}});K.pathFilter=A,K.pointsFilter=E,K.subdivideRawBezier=m,K.defaultMap="size",K.pathDataToRawBezier=function(a){return l(I(a,!0))},K.equalizeSegmentQuantity=z,K.convertToPath=function(a,b){"string"==typeof a&&(a=h.selector(a));for(var c=a&&0!==a.length?a.length&&a[0]&&a[0].nodeType?Array.prototype.slice.call(a,0):[a]:[],d=c.length;--d>-1;)c[d]=H(c[d],b!==!1);return c},K.pathDataToBezier=function(a,b){var c,d,e,f,g,i,j,k,m=l(I(a,!0))[0]||[],n=0;if(b=b||{},k=b.align||b.relative,f=b.matrix||[1,0,0,1,0,0],g=b.offsetX||0,i=b.offsetY||0,"relative"===k||k===!0?(g-=m[0]*f[0]+m[1]*f[2],i-=m[0]*f[1]+m[1]*f[3],n="+="):(g+=f[4],i+=f[5],k&&(k="string"==typeof k?h.selector(k):k&&k[0]?k:[k],k&&k[0]&&(j=k[0].getBBox()||{x:0,y:0},g-=j.x,i-=j.y))),c=[],e=m.length,f&&"1,0,0,1,0,0"!==f.join(","))for(d=0;e>d;d+=2)c.push({x:n+(m[d]*f[0]+m[d+1]*f[2]+g),y:n+(m[d]*f[1]+m[d+1]*f[3]+i)});else for(d=0;e>d;d+=2)c.push({x:n+(m[d]+g),y:n+(m[d+1]+i)});return c}}),_gsScope._gsDefine&&_gsScope._gsQueue.pop()(),function(a){"use strict";var b=function(){return(_gsScope.GreenSockGlobals||_gsScope)[a]};"undefined"!=typeof module&&module.exports?(require("../TweenLite.min.js"),module.exports=b()):"function"==typeof define&&define.amd&&define(["TweenLite"],b)}("MorphSVGPlugin");
