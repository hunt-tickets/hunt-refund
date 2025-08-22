import { createNoise3D } from 'simplex-noise'

export class WavyBackground {
  constructor(options = {}) {
    this.options = {
      colors: ['#38bdf8', '#818cf8', '#c084fc', '#e879f9', '#22d3ee'],
      waveWidth: 50,
      backgroundFill: '#0a0a0a',
      blur: 8,
      speed: 'slow',
      waveOpacity: 0.3,
      ...options
    }
    
    this.noise = createNoise3D()
    this.canvas = null
    this.ctx = null
    this.w = 0
    this.h = 0
    this.nt = 0
    this.animationId = null
    this.container = null
  }

  getSpeed() {
    switch (this.options.speed) {
      case 'slow':
        return 0.0005
      case 'fast':
        return 0.002
      default:
        return 0.001
    }
  }

  init() {
    // Create container
    this.container = document.createElement('div')
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      overflow: hidden;
    `

    // Create canvas
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `
    
    this.container.appendChild(this.canvas)
    
    this.ctx = this.canvas.getContext('2d')
    this.w = this.ctx.canvas.width = window.innerWidth
    this.h = this.ctx.canvas.height = window.innerHeight
    this.ctx.filter = `blur(${this.options.blur}px)`
    this.nt = 0

    // Handle resize
    this.handleResize = () => {
      this.w = this.ctx.canvas.width = window.innerWidth
      this.h = this.ctx.canvas.height = window.innerHeight
      this.ctx.filter = `blur(${this.options.blur}px)`
    }
    window.addEventListener('resize', this.handleResize)

    this.render()
    return this.container
  }

  drawWave(n) {
    this.nt += this.getSpeed()
    
    for (let i = 0; i < n; i++) {
      this.ctx.beginPath()
      this.ctx.lineWidth = this.options.waveWidth
      this.ctx.strokeStyle = this.options.colors[i % this.options.colors.length]
      
      for (let x = 0; x < this.w; x += 5) {
        const y = this.noise(x / 800, 0.3 * i, this.nt) * 100
        this.ctx.lineTo(x, y + this.h * 0.5)
      }
      
      this.ctx.stroke()
      this.ctx.closePath()
    }
  }

  render = () => {
    // Clear canvas with background
    this.ctx.fillStyle = this.options.backgroundFill
    this.ctx.fillRect(0, 0, this.w, this.h)
    
    // Set wave opacity
    this.ctx.globalAlpha = this.options.waveOpacity
    
    // Draw waves
    this.drawWave(5)
    
    // Continue animation
    this.animationId = requestAnimationFrame(this.render)
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    if (this.handleResize) {
      window.removeEventListener('resize', this.handleResize)
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}