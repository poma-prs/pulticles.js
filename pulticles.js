/* -----------------------------------------------
/* Author : Roman Poskrebyshev
/* MIT license: http://opensource.org/licenses/MIT
/* How to use? : Check the GitHub README
/* v0.0.1
/* ----------------------------------------------- */

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    } else if (typeof define === "function" && define.amd) {
        define([], f)
    } else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        } else if (typeof global !== "undefined") {
            g = global
        } else if (typeof self !== "undefined") {
            g = self
        } else {
            g = this
        }
        g.Pulticles = f;

    }
})(function(canvas, options) {
    if (options === void 0) options = {};
    options = Object.assign({
        edgeLightUpSpeed: .002,
        edgeFadeSpeed: .001,
        edgeLightUpBrightness: .2,
        eraseAlpha: .5,
        trailSize: 25,
        pulseChance: .06,
        maxPulsesPerSpawn: 1,
        maxPulses: 10,
        minVertexRadius: 1,
        minPulseSpeed: .03 / 2.25,
        pulseSpeedVariation: .04 / 2.25,
        vertexRadiusVariation: 1,
        spacing: 80,
        bg: [71, 125, 194],
        fg: [128, 198, 255]
    }, options);

    var PI2 = Math.PI * 2;
    var dpi = window.devicePixelRatio;
    var ctx = canvas.getContext("2d");
    var bounds = canvas.getBoundingClientRect();
    var width = bounds.width * dpi;
    var height = bounds.height * dpi;
    var lastBliped = [];
    var clear = false;
    var repeat = function(times, callback) {
        for (var i = 0; i < times; i++) {
            callback(i)
        }
    };

    var last = function(arr) {
        return arr[arr.length - 1]
    };

    function drawCircle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x * dpi, y * dpi, r * dpi, 0, PI2);
        ctx.closePath()
    }

    function fillCircle(ctx, x, y, r) {
        drawCircle(ctx, x, y, r);
        ctx.fill()
    }

    function strokeCircle(ctx, x, y, r) {
        drawCircle(ctx, x, y, r);
        ctx.stroke()
    }

    function Color(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b
    }

    Color.prototype = {
        r: 0,
        g: 0,
        b: 0,
        interpolate: function interpolate(color, p) {
            var dr = color.r - this.r;
            var dg = color.g - this.g;
            var db = color.b - this.b;
            return new Color(this.r + dr * p, this.g + dg * p, this.b + db * p)
        },
        toString: function toString() {
            return "rgb(" + Math.round(this.r) + "," + Math.round(this.g) + "," + Math.round(this.b) + ")"
        }
    };
    var color = {
        bg: new Color(options.bg[0], options.bg[1], options.bg[2]),
        fg: new Color(options.fg[0], options.fg[1], options.fg[2])
    };
    var getColor = function(v) {
        return color.bg.interpolate(color.fg, v).toString()
    };

    function createGrid(width, height, spacing) {
        var margin = spacing / 2;
        var cols = Math.ceil(width / spacing) + 1;
        var rows = Math.ceil(3 * height / spacing) + 1;
        var numParticles = cols * rows;
        var pointcnt = 4;

        var particles = [];
        var edges = [];
        for (var i = 0; i < rows; ++i) {
            for (var j = 0; j < cols; ++j) {
                particles.push({
                    x: ((i % 4) < 2 ? j * spacing : j * spacing + spacing / 2) - margin,
                    y: Math.floor(i / 2) * spacing + (i % 2) * 3 * spacing / 4 - margin
                })
                if (i > 0) {
                    edges.push({
                        va: particles[i * cols + j],
                        vb: particles[(i - 1) * cols + j]
                    })
                }
                if (i > 0 && i % 4 == 0 && j > 0) {
                    edges.push({
                        va: particles[i * cols + j],
                        vb: particles[(i - 1) * cols + j - 1]
                    })
                }
                if (i % 4 == 2 && j < cols - 1) {
                    edges.push({
                        va: particles[i * cols + j],
                        vb: particles[(i - 1) * cols + j + 1]
                    })
                }
            }
        }

        return {
            vertices: particles,
            edges: edges
        };
    }

    function getNeighbors(diagram, vertex, exclude) {
        if (exclude === void 0) exclude = null;
        var edges = diagram.edges.filter(function(edge) {
            return (edge.va == vertex || edge.vb == vertex) && (edge.va != exclude && edge.vb != exclude)
        });
        return edges.reduce(function(arr, cur) {
            return arr.concat(cur.va, cur.vb)
        }, []).filter(function(v) {
            return v != vertex
        })
    }

    function initDiagram(diagram) {
        diagram.pulses = [];
        diagram.pulse = function(origin, dest) {
            var pulse = new Pulse(origin, dest);
            pulse.speed = options.minPulseSpeed + options.pulseSpeedVariation * Math.random();
            if (diagram.pulses.length < options.maxPulses) {
                //origin.lightUp();
                diagram.pulses.push(pulse);
                var edge = origin.diagram.edges.find(function(edge) {
                    return edge.va == origin && edge.vb == dest || edge.vb == origin && edge.va == dest
                });
                edge.lightUp();
                return pulse
            } else return null
        };
        initVertices(diagram);
        initEdges(diagram);
        diagram.outerVertices = diagram.vertices.filter(function(vertex) {
            return vertex.y <= 0 || vertex.y >= diagram.height ||
                vertex.x <= 0 || vertex.x >= diagram.width;
        })
    }

    function initEdges(diagram) {
        diagram.edges.forEach(function(edge) {
            edge.color = 0;
            edge.colorTo = 0;
            edge.lightUp = function() {
                edge.colorTo = options.edgeLightUpBrightness;
                edge.color = Math.max(edge.color, 1e-4)
            };
            edge.update = function() {
                if (edge.colorTo > 0) {
                    edge.color += options.edgeLightUpSpeed;
                    edge.colorTo -= options.edgeLightUpSpeed;
                    if (edge.colorTo < 0) edge.colorTo = 0
                } else if (edge.color > 0) {
                    edge.color -= options.edgeFadeSpeed;
                    if (edge.color < 0) edge.color = 0
                }
            }
        })
    }

    function initVertices(diagram) {
        var maxClockSpeed = .001;
        var maxClockIntensity = 0 * .1;
        diagram.vertices.forEach(function(vertex) {
            var depth = Math.random();
            vertex.diagram = diagram;
            vertex.clockSpeed = -maxClockSpeed + Math.random() * (maxClockSpeed * 2);
            vertex.clock = Math.random() * PI2;
            vertex.originX = vertex.x;
            vertex.originY = vertex.y;
            vertex.clockIntensity = 0 + maxClockIntensity * Math.pow(depth, 3);
            vertex.depth = depth;
            vertex.radius = options.minVertexRadius + depth * options.vertexRadiusVariation;
            vertex.color = 0;
            vertex.colorFadeSpeed = .01;
            vertex.blips = [];
            vertex.blipSpeed = .04;
            vertex.blipRadius = vertex.radius * 3.5 + Math.random() * vertex.radius * 1;
            vertex.forceStrength = 4;
            vertex.forces = [];
            vertex.neighbors = getNeighbors(diagram, vertex);
            vertex.getRandomNeighbor = function(exclude) {
                if (exclude === void 0) exclude = null;
                var neighbors = this.neighbors.filter(function(neighbor) {
                    return neighbor != exclude
                });
                if (neighbors.length == 0) return null;
                var neighbor = neighbors[Math.round(Math.random() * (neighbors.length - 1))];
                return neighbor
            };
            vertex.lightUp = function() {
                this.color = 1
            };
            vertex.blip = function() {
                this.blips.push(1)
            };
            vertex.applyForces = function() {
                var result = {
                    x: 0,
                    y: 0
                };
                for (var i = vertex.forces.length - 1; i >= 0; i--) {
                    var force = vertex.forces[i];
                    var p = Math.pow(force.power, 3);
                    result.x += force.cosAngle * p * force.strength;
                    result.y += force.sinAngle * p * force.strength;
                    force.update();
                    if (force.dead) {
                        vertex.forces.splice(i, 1)
                    }
                }
                return result
            };
            vertex.update = function() {
                var this$1 = this;
                if (this.color > 0) {
                    this.color -= this.colorFadeSpeed;
                    if (this.color < 0) this.color = 0
                }
                this.blips = this.blips.map(function(blip) {
                    return blip -= this$1.blipSpeed
                }).filter(function(blip) {
                    return blip > 0
                })
            }
        })
    }

    function Force(angle, strength) {
        this.angle = angle;
        this.power = 1;
        this.strength = strength;
        this.cosAngle = Math.cos(angle);
        this.sinAngle = Math.sin(angle)
    }
    Force.prototype = {
        angle: 0,
        power: 0,
        dead: false,
        cosAngle: 0,
        sinAngle: 0,
        update: function update() {
            this.power -= .03;
            if (this.power <= 0) this.dead = true
        }
    };

    function Pulse(origin, dest) {
        this.origin = origin;
        this.dest = dest;
        this.lastPos = []
    }
    Pulse.prototype = {
        origin: null,
        dest: null,
        v: 0,
        speed: .03 + Math.random() * .05,
        angle: 0,
        dying: false,
        dyingCounter: options.trailSize,
        dead: false,
        lastPos: null,
        sparkRandom: .2,
        update: function update$1(delta) {
            var this$1 = this;
            if (delta === void 0) delta = 1;
            if (this.dying) {
                this.dyingCounter--;
                if (this.dyingCounter <= 0) this.dead = true;
                return
            }
            if (this.v >= 1) {
                this.dying = true;
                var p = this;
                var newPulses = Math.round(Math.random() * 2.45);
                var failedPulses = 0;
                var lastTargets = [];
                if (newPulses > 0) {
                    repeat(newPulses, function(i) {
                        var neighbor = this$1.dest.getRandomNeighbor(this$1.origin);
                        if (neighbor == null) {
                            failedPulses++;
                            return
                        }
                        if (lastTargets.indexOf(neighbor) > -1) {
                            failedPulses++;
                            return
                        }
                        var newPulse = this$1.dest.diagram.pulse(this$1.dest, neighbor);
                        if (newPulse == null) {
                            failedPulses++;
                            return
                        }
                        lastTargets.push(neighbor);
                        newPulse.speed = this$1.speed;
                        newPulse.lastPos = this$1.lastPos.slice(this$1.lastPos.length - 4)
                    })
                }
                var forceStrength = 1 + Math.random() * 1;
                if (newPulses == 0 || failedPulses >= newPulses) {
                    this.dest.blip();
                    lastBliped = [this.dest].concat(lastBliped.slice(0, 20));
                    //this.dest.lightUp();
                    forceStrength = 7.5 + this.dest.depth * 6
                }
                var dx = this.dest.x - this.origin.x;
                var dy = this.dest.y - this.origin.y;
                var angle = Math.atan2(dy, dx);
                this.dest.forces.push(new Force(angle, forceStrength))
            }
            this.v += this.speed * delta;
            if (this.v > 1) this.v = 1
        },
        getPos: function getPos() {
            var pos = {
                x: 0,
                y: 0
            };
            if (this.dying) {
                pos = this.lastPos[this.lastPos.length - 1]
            } else {
                var dx = this.dest.x - this.origin.x;
                var dy = this.dest.y - this.origin.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var angle = Math.atan2(dy, dx);
                this.angle = angle;
                pos = {
                    x: this.origin.x + Math.cos(angle) * (dist * this.v),
                    y: this.origin.y + Math.sin(angle) * (dist * this.v)
                };
                var sparkRandom = this.sparkRandom;
                pos.x += -(sparkRandom / 2) + Math.random() * sparkRandom;
                pos.y += -(sparkRandom / 2) + Math.random() * sparkRandom
            }
            this.lastPos = this.lastPos.slice(this.lastPos.length - options.trailSize).concat(pos);
            return pos
        }
    };

    function drawDiagram(diagram, ctx, width, height, delta) {
        if (Math.random() < options.pulseChance) {
            repeat(Math.random() * options.maxPulsesPerSpawn, function(i) {
                var origin = diagram.outerVertices[Math.round(Math.random() * (diagram.outerVertices.length - 1))];
                var dest = origin.getRandomNeighbor();
                if (lastBliped.length > 0 && (dest == null || Math.random() < .1)) {
                    origin = lastBliped[Math.round(Math.random() * (lastBliped.length - 1))];
                    dest = origin.getRandomNeighbor();
                    if (dest == null) return
                } else if (dest == null) return;
                var newPulse = diagram.pulse(origin, dest);
                if (newPulse != null) {
                    var dx = dest.x - origin.x;
                    var dy = dest.y - origin.y;
                    var angle = Math.atan2(dy, dx);
                    angle += Math.PI
                }
            })
        }
        ctx.fillStyle = getColor(0);
        ctx.globalAlpha = options.eraseAlpha;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        ctx.fillStyle = getColor(.2);
        ctx.strokeStyle = getColor(.15);
        ctx.lineCap = "round";
        diagram.edges.forEach(function(edge) {
            if (edge.color <= 0) return;
            ctx.beginPath();
            ctx.moveTo(edge.va.x * dpi, edge.va.y * dpi);
            ctx.lineTo(edge.vb.x * dpi, edge.vb.y * dpi);
            ctx.strokeStyle = getColor(edge.color);
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1 * dpi;
            ctx.stroke();
            edge.update()
        });
        diagram.pulses.forEach(function(pulse) {
            var pos = pulse.getPos();
            pulse.update(delta);
            ctx.beginPath();
            ctx.moveTo(pulse.lastPos[0].x * dpi, pulse.lastPos[0].y * dpi);
            pulse.lastPos.slice(1).forEach(function(p) {
                ctx.lineTo(p.x * dpi, p.y * dpi)
            });
            ctx.strokeStyle = getColor(1);
            ctx.globalAlpha = .7;
            ctx.lineWidth = 1 * dpi;
            ctx.stroke();
            if (pulse.lastPos.length >= 2 && !pulse.dying) {
                ctx.lineWidth = 5 * dpi;
                ctx.globalAlpha = .7;
                ctx.beginPath();
                var lastPos2 = pulse.lastPos.length - 2;
                var lastPos1 = pulse.lastPos.length - 1;
                ctx.moveTo(pulse.lastPos[lastPos2].x * dpi, pulse.lastPos[lastPos2].y * dpi);
                ctx.lineTo(pulse.lastPos[lastPos1].x * dpi, pulse.lastPos[lastPos1].y * dpi);
                ctx.strokeStyle = getColor(1);
                ctx.stroke()
            }
        });
        diagram.vertices.forEach(function(vertex) {
            var forces = vertex.applyForces();
            vertex.x = vertex.originX + forces.x;
            vertex.y = vertex.originY + forces.y;
            if (vertex.color > 0) {
                var depth = vertex.depth;
                var minColor = .1 + depth * depth * .2;
                minColor = 0;
                var color = getColor(minColor + Math.min(1, vertex.color) * (1 - minColor));
                ctx.fillStyle = color;
                ctx.globalAlpha = 1 - (1 - depth) * .35;
                fillCircle(ctx, vertex.x, vertex.y, vertex.radius)
            }
                fillCircle(ctx, vertex.x, vertex.y, vertex.radius)
            vertex.blips.forEach(function(blip) {
                var iblip = 1 - blip;
                var blipRadius = vertex.radius + vertex.blipRadius * Math.pow(iblip, 1 / 2);
                var blipAlpha = blip * 1;
                ctx.globalAlpha = blipAlpha;
                ctx.lineWidth = 1 * dpi;
                ctx.strokeStyle = getColor(1);
                strokeCircle(ctx, vertex.x, vertex.y, blipRadius)
            });
            vertex.update()
        });
        diagram.pulses = diagram.pulses.filter(function(pulse) {
            return !pulse.dead
        })
    }

    function init(ctx, width, height) {
        var diagram = createGrid(width / dpi, height / dpi, options.spacing);
        diagram.width = width / dpi;
        diagram.height = height / dpi;
        initDiagram(diagram);
        var last = 0;
        var fps = 60;
        var maxDelta = 1.5;
        (function draw(now) {
            if (clear) {
                return
            }
            var delta = (now - last) / (fps / 1e3);
            if (delta > maxDelta) delta = maxDelta;
            drawDiagram(diagram, ctx, width, height, delta);
            requestAnimationFrame(draw)
        })()
    }

    function stop() {
        clear = true
    }

    function reset() {
        window.removeEventListener("resize", reset);
        stop();
        Pulticles(canvas, options)
    }

    window.addEventListener("resize", reset);
    canvas.setAttribute("width", width);
    canvas.setAttribute("height", height);
    init(ctx, width, height)
})