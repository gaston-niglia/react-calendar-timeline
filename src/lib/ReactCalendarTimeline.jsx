import React, { Component } from 'react';
import moment from 'moment';

// import './ReactCalendarTimeline.scss';

import Items from './items/Items.jsx';
import InfoLabel from './layout/InfoLabel.jsx';
import Controls from './layout/Controls.jsx';
import Sidebar from './layout/Sidebar.jsx';
import Header from './layout/Header.jsx';
import VerticalLines from './lines/VerticalLines.jsx';
import TodayLine from './lines/TodayLine.jsx';

import { iterateTimes, getMinUnit, getNextUnit, getParentPosition, createGradientPattern } from './utils.js';

import _throttle from 'lodash/function/throttle';
import _min from 'lodash/math/min';
import _max from 'lodash/math/max';

export default class ReactCalendarTimeline extends Component {
  constructor(props) {
    super(props);

    let minTime = _min(this.props.items.map(item => item.start.getTime())),
        maxTime = _max(this.props.items.map(item => item.end.getTime()));

    if (!minTime || !maxTime) {
      minTime = new Date().getTime() - 86400 * 7 * 1000;
      maxTime = new Date().getTime() + 86400 * 7 * 1000;
    }

    this.state = {
      width: 1000,
      lineHeight: 30,
      minTime: minTime,
      maxTime: maxTime,
      zoom: maxTime - minTime,
      originX: minTime - (maxTime - minTime),
      visible: false,
      selectedItem: null,
      dragTime: null,
      dragGroupTitle: null,
      resizeLength: null
    };
  }

  componentDidMount() {
    this.resize();
    window.addEventListener('resize', this.resize);

    this.lastTouchDistance = null;
    this.refs.scrollComponent.addEventListener('touchstart', this.touchStart.bind(this));
    this.refs.scrollComponent.addEventListener('touchmove', this.touchMove.bind(this));
    this.refs.scrollComponent.addEventListener('touchend', this.touchEnd.bind(this));
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resize);
    this.refs.scrollComponent.removeEventListener('touchstart', this.touchStart.bind(this));
    this.refs.scrollComponent.removeEventListener('touchmove', this.touchMove.bind(this));
    this.refs.scrollComponent.removeEventListener('touchend', this.touchEnd.bind(this));
  }

  touchStart(e) {
    if (e.touches.length == 2) {
      e.preventDefault();

      this.lastTouchDistance = Math.abs(e.touches[0].screenX - e.touches[1].screenX);
      this.singleTouchStart = null;
      this.lastSingleTouch = null;
    } else if(e.touches.length == 1) {
      e.preventDefault();

      let x = e.touches[0].clientX,
          y = e.touches[0].clientY;

      this.lastTouchDistance = null;
      this.singleTouchStart = {x: x, y: y, screenY: window.pageYOffset};
      this.lastSingleTouch = {x: x, y: y, screenY: window.pageYOffset};
    }
  }

  touchMove(e) {
    if (this.state.dragTime || this.state.resizeLength) {
      e.preventDefault();
      return;
    }
    if (this.lastTouchDistance && e.touches.length == 2) {
      e.preventDefault();

      let touchDistance = Math.abs(e.touches[0].screenX - e.touches[1].screenX);

      let parentPosition = getParentPosition(e.currentTarget),
          xPosition = (e.touches[0].screenX + e.touches[1].screenX) / 2 - parentPosition.x;

      if (touchDistance != 0 && this.lastTouchDistance != 0) {
        this.changeZoom(this.lastTouchDistance / touchDistance, xPosition / this.state.width);
        this.lastTouchDistance = touchDistance;
      }
    } else if (this.lastSingleTouch && e.touches.length == 1) {
      e.preventDefault();

      let x = e.touches[0].clientX,
          y = e.touches[0].clientY;

      let deltaX = x - this.lastSingleTouch.x,
          deltaY = y - this.lastSingleTouch.y;

      let deltaX0 = x - this.singleTouchStart.x,
          deltaY0 = y - this.singleTouchStart.y;

      this.lastSingleTouch = {x: x, y: y};

      let moveX = Math.abs(deltaX0) * 3 > Math.abs(deltaY0),
          moveY = Math.abs(deltaY0) * 3 > Math.abs(deltaX0);

      if (deltaX != 0 && moveX) {
        this.refs.scrollComponent.scrollLeft -= deltaX;
      }
      if (moveY) {
        window.scrollTo(window.pageXOffset, this.singleTouchStart.screenY - deltaY0);
      }

    }
  }

  touchEnd(e) {
    if (this.lastTouchDistance) {
      e.preventDefault();
      console.log('end multi');

      this.lastTouchDistance = null;
    }
    if (this.lastSingleTouch) {
      e.preventDefault();

      console.log('end');
      this.lastSingleTouch = null;
      this.singleTouchStart = null;
    }
  }

  resize = _throttle(() => {
    let width = this.refs.container.clientWidth - this.props.sidebarWidth;
    this.setState({
      width: width,
      visible: true
    });
    this.refs.scrollComponent.scrollLeft = width;
  }, 30)

  onScroll() {
    let scrollComponent = this.refs.scrollComponent,
        originX = this.state.originX,
        scrollX = scrollComponent.scrollLeft,
        zoom = this.state.zoom,
        width = this.state.width,
        minTime = originX + (zoom * scrollX / width);

    this.setState({
      minTime: minTime,
      maxTime: minTime + zoom
    })

    if (scrollX < this.state.width * 0.5) {
      this.setState({originX: this.state.originX - this.state.zoom});
      scrollComponent.scrollLeft += this.state.width;
    }
    if (scrollX > this.state.width * 1.5) {
      this.setState({originX: this.state.originX + this.state.zoom});
      scrollComponent.scrollLeft -= this.state.width;
    }
  }

  onWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();

      let parentPosition = getParentPosition(e.currentTarget),
          xPosition = e.clientX - parentPosition.x;

      this.changeZoom(1.0 + e.deltaY / 50, xPosition / this.state.width);
    } else {
      e.preventDefault();
      if (e.deltaX != 0) {
        this.refs.scrollComponent.scrollLeft += e.deltaX;
      }
      if (e.deltaY != 0) {
        window.scrollTo(window.pageXOffset, window.pageYOffset + e.deltaY);
      }
    }
  }

  zoomIn(e) {
    e.preventDefault();

    this.changeZoom(0.75);
  }

  zoomOut(e) {
    e.preventDefault();

    this.changeZoom(1.25);
  }

  changeZoom(scale, offset = 0.5) {
    let oldZoom = this.state.zoom,
        newZoom = Math.min(Math.max(Math.round(oldZoom * scale), 60*60*1000), 20*365.24*86400*1000), // min 1 min, max 20 years
        realScale = newZoom / oldZoom,
        middle = Math.round(this.state.minTime + oldZoom * offset),
        oldBefore = middle - this.state.originX,
        newBefore = Math.round(oldBefore * realScale),
        newOriginX = this.state.originX + (oldBefore - newBefore),
        newMinTime = Math.round(this.state.minTime + (oldZoom - newZoom) * offset);

    this.setState({
      zoom: newZoom,
      originX: newOriginX,
      minTime: newMinTime,
      maxTime: newMinTime + newZoom
    })
  }

  showPeriod(from, unit) {
    let minTime = from.valueOf(),
        maxTime = moment(from).add(1, unit),
        zoom = maxTime - minTime;

    // can't zoom in more than to show one hour
    if (zoom < 360000) {
      return;
    }

    // clicked on the big header and already focused here, zoom out
    if (unit != 'year' && this.state.minTime == minTime && this.state.maxTime == maxTime) {
      let nextUnit = getNextUnit(unit);

      minTime = from.startOf(nextUnit).valueOf();
      maxTime = moment(minTime).add(1, nextUnit);
      zoom = maxTime - minTime;
    }

    this.setState({
      zoom: zoom,
      originX: minTime - zoom,
      minTime: minTime,
      maxTime: minTime + zoom
    });

    this.refs.scrollComponent.scrollLeft = this.state.width;
  }

  selectItem(item) {
    if (this.state.selectedItem === item) {
      if (item && this.props.itemClick) {
        this.props.itemClick(item);
      }
    } else {
      this.setState({selectedItem: item});
    }
  }

  canvasClick(e) {
    if (e.target.className !== 'timeline-item') {
      this.selectItem(null);
    }
  }

  dragItem(item, dragTime, newGroupOrder) {
    let newGroup = this.props.groups[newGroupOrder];
    this.setState({
      dragTime: dragTime,
      dragGroupTitle: newGroup ? newGroup.title : ''
    })
  }

  dropItem(item, dragTime, newGroupOrder) {
    this.setState({dragTime: null, dragGroupTitle: null});
    if (this.props.moveItem) {
      this.props.moveItem(item, dragTime, newGroupOrder);
    }
  }

  resizingItem(item, newLength) {
    this.setState({resizeLength: newLength});
  }

  resizedItem(item, newLength) {
    this.setState({resizeLength: null});
    if (this.props.resizeItem) {
      this.props.resizeItem(item, newLength);
    }
  }

  infoLabel() {
    let label = null;

    if (this.state.dragTime) {
      label = `${moment(this.state.dragTime).format('LLL')}, ${this.state.dragGroupTitle}`;
    } else if (this.state.resizeLength) {
      let minutes = Math.floor(this.state.resizeLength / (60 * 1000)),
          hours = Math.floor(minutes / 60),
          days = Math.floor(hours / 24);

      minutes = minutes % 60;
      hours = hours % 24;

      let parts = []
      if (days > 0) {
        parts.push(`${days} d`);
      }
      if (hours > 0 || days > 0) {
        parts.push(`${hours} h`);
      }
      parts.push(`${minutes < 10 ? '0' : ''}${minutes} min`);
      label = parts.join(', ');
    }
    return label;
  }

  render() {
    let width = this.state.width,
        height = (this.props.groups.length + 2) * this.state.lineHeight,
        zoom = this.state.zoom,
        canvasWidth = this.state.width * 3,
        originX = this.state.originX,
        maxX = originX + this.state.zoom * 3;

    let minUnit = getMinUnit(zoom, this.state.width);

    let evenRowBackground = '#ffffff',
        oddRowBackground = '#f0f0f0',
        headerColor = '#ffffff',
        headerBackgroundColor = '#c52020',
        sidebarColor = '#ffffff',
        sidebarBackgroundColor = '#c52020',
        lowerHeaderColor = '#333333',
        lowerHeaderBackgroundColor = '#f0f0f0',
        borderColor = '#bbb',
        gradientBackground = createGradientPattern(this.state.lineHeight, evenRowBackground, oddRowBackground, borderColor);

    const staticProps = {
      originX: originX,
      maxX: maxX,
      canvasWidth: canvasWidth,
      lineHeight: this.state.lineHeight
    };

    const extraProps = {
      lineCount: this.props.groups.length,
      minUnit: minUnit
    };

    const itemProps = {
      items: this.props.items,
      groups: this.props.groups,
      selectedItem: this.state.selectedItem,
      dragSnap: this.props.dragSnap,
      minResizeWidth: this.props.minResizeWidth,
      canMove: this.props.canMove,
      canResize: this.props.canResize,
      itemSelect: this.selectItem.bind(this),
      itemDrag: this.dragItem.bind(this),
      itemDrop: this.dropItem.bind(this),
      itemResizing: this.resizingItem.bind(this),
      itemResized: this.resizedItem.bind(this)
    };

    const sidebarProps = {
      groups: this.props.groups,

      width: this.props.sidebarWidth,
      lineHeight: this.state.lineHeight,

      fixedHeader: this.props.fixedHeader,
      zIndex: this.props.zIndexStart + 2,

      sidebarColor: sidebarColor,
      sidebarBackgroundColor: sidebarBackgroundColor,
      sidebarBorderRight: '1px solid #aaa',
      gradientBackground: gradientBackground,
    };

    const headerProps = {
      minUnit: minUnit,
      width: width,
      zoom: zoom,
      minTime: this.state.minTime,
      maxTime: this.state.maxTime,
      headerColor: headerColor,
      headerBackgroundColor: headerBackgroundColor,
      lowerHeaderColor: lowerHeaderColor,
      lowerHeaderBackgroundColor: lowerHeaderBackgroundColor,
      borderColor: borderColor,
      fixedHeader: this.props.fixedHeader,
      zIndex: this.props.zIndexStart + 1,
      showPeriod: this.showPeriod.bind(this)
    };

    const scrollComponentStyle = {
      display: 'inline-block',
      width: `${width}px`,
      height: `${height}px`,
      verticalAlign: 'top',
      overflowX: 'scroll',
      overflowY: 'hidden'
    };

    const canvasComponentStyle = {
      position: 'relative',
      width: canvasWidth+'px',
      height: height+'px',
      background: gradientBackground
    };

    return (
      <div style={this.props.style || {}} ref='container' className="react-calendar-timeline">
        {this.props.controls ? <Controls changeZoom={this.changeZoom.bind(this)} /> : ''}
        <div>
          <Sidebar {...sidebarProps}>
            {this.props.children}
          </Sidebar>
          <div ref='scrollComponent' style={scrollComponentStyle} onScroll={this.onScroll.bind(this)} onWheel={this.onWheel.bind(this)}>
            <div ref='canvasComponent' style={canvasComponentStyle} onClick={this.canvasClick.bind(this)}>
              <TodayLine {...staticProps} {...extraProps} />
              <VerticalLines {...staticProps} {...extraProps} borderColor={borderColor} />
              <Items {...staticProps} {...itemProps} />
              {this.infoLabel() ? <InfoLabel label={this.infoLabel()} /> : ''}
              <Header {...staticProps} {...headerProps} />
            </div>
          </div>
        </div>
      </div>
    )
  }
}

ReactCalendarTimeline.propTypes = {
  groups: React.PropTypes.array.isRequired,
  items: React.PropTypes.array.isRequired,
  sidebarWidth: React.PropTypes.number,
  dragSnap: React.PropTypes.number,
  minResizeWidth: React.PropTypes.number,
  zIndexStart: React.PropTypes.number,
  controls: React.PropTypes.bool,
  fixedHeader: React.PropTypes.bool,

  canMove: React.PropTypes.bool,
  canResize: React.PropTypes.bool,

  moveItem: React.PropTypes.func,
  resizeItem: React.PropTypes.func,
  itemClick: React.PropTypes.func
};
ReactCalendarTimeline.defaultProps = {
  sidebarWidth: 150,
  dragSnap: 1000 * 60 * 15, // 15min
  minResizeWidth: 20,
  controls: false,
  fixedHeader: false,
  zIndexStart: 10,

  canMove: true,
  canResize: true
}