let v = 0;
const urlParams = new URLSearchParams(location.search);

function getParam(paramName, defaultValue) {
    return urlParams.has(paramName) ? parseFloat(urlParams.get(paramName)) : defaultValue
}

const numberOfFields = 10
const numberOfBalls = getParam("balls", 100),
    memoryForBalls = numberOfBalls * numberOfFields * Float32Array.BYTES_PER_ELEMENT,
    minRadius = getParam("min_radius", 2),
    maxRadius = getParam("max_radius", 10),
    toRender = getParam("render", 1),
    plusProbability = getParam("plus_probability", 0.5),
    canvas = document.querySelector("canvas").getContext("2d");
canvas.canvas.width = getParam("width", 500);
canvas.canvas.height = getParam("height", 500);

function throwError(errorText) {
    throw document.body.innerHTML = `<pre>${errorText}</pre>`, Error(errorText)
}

"gpu" in navigator || throwError("WebGPU not supported. Please enable it in about:flags in Chrome or in about:config in Firefox.");
const adapter = await navigator.gpu.requestAdapter();
adapter || throwError("Couldn't request WebGPU adapter.");
const device = await adapter.requestDevice();
device || throwError("Couldn't request WebGPU device.");

const wgslScriptPath = "draft.wgsl"

const wgslCode = await fetch(wgslScriptPath)
    .then(r => r.text())
const computationModule = device.createShaderModule({
        code: wgslCode
    }),
    computationalLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {type: "read-only-storage"}
        }, {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: {type: "storage"}}, {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {type: "read-only-storage"}
        }]
    }),
    computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({bindGroupLayouts: [computationalLayout]}),
        compute: {module: computationModule, entryPoint: "main"}
    }),
    canvasSizeBuffer = device.createBuffer({
        size: 2 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    }),
    ballsBuffer1 = device.createBuffer({
        size: memoryForBalls,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    }),
    ballsBuffer2 = device.createBuffer({
        size: memoryForBalls,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    }),
    ballsBuffer3 = device.createBuffer({
        size: memoryForBalls,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    }),
    bindGroup = device.createBindGroup({
        layout: computationalLayout,
        entries: [{binding: 0, resource: {buffer: ballsBuffer1}}, {
            binding: 1,
            resource: {buffer: ballsBuffer2}
        }, {
            binding: 2,
            resource: {buffer: canvasSizeBuffer}
        }]
    });

function promiseRequestAnimationFrame() {
    return new Promise(e => requestAnimationFrame(e))
}

let jsBallsArray = new Float32Array(new ArrayBuffer(memoryForBalls));
// the first particle is what keeps other from moving away
jsBallsArray[0] = 2 * maxRadius // particle radius
jsBallsArray[1] = 0 // charge
jsBallsArray[2] = 1e4 // mass
jsBallsArray[4] = canvas.canvas.width / 2 // particle x
jsBallsArray[5] = canvas.canvas.height / 2 // particle y
for (let e = 1; e < numberOfBalls; e++) {
    jsBallsArray[e * numberOfFields + 0] = randFloat(minRadius, maxRadius) // particle radius
    jsBallsArray[e * numberOfFields + 1] = randSign(plusProbability) // randInt(-1, 1) // charge
    jsBallsArray[e * numberOfFields + 2] = Math.pow(jsBallsArray[e * numberOfFields + 0], 2) * Math.PI
    jsBallsArray[e * numberOfFields + 4] = randFloat(0, canvas.canvas.width) // particle x
    jsBallsArray[e * numberOfFields + 5] = randFloat(0, canvas.canvas.height) // particle y
    jsBallsArray[e * numberOfFields + 6] = 0 // randFloat(-100, 100) // velocity x
    jsBallsArray[e * numberOfFields + 7] = 0 // randFloat(-100, 100); // velocity y
    jsBallsArray[e * numberOfFields + 8] = 0.0 // acceleration
    jsBallsArray[e * numberOfFields + 9] = 0.0 // acceleration
}
let nextBalls;
device.queue.writeBuffer(canvasSizeBuffer, 0, new Float32Array([canvas.canvas.width, canvas.canvas.height]));

//   --FPS-- //
function fps() {
    const currentTimestamp = performance.now();
    // delta time
    const elapsedMilliseconds = currentTimestamp - lastTimestamp;
    // for delta = 1000ms = 1sec = 1/T = Hz
    if (elapsedMilliseconds >= 1000) {  // Update every second
        const fps = frameCount / (elapsedMilliseconds / 1000); // Calculate FPS
        fpsDisplay.textContent = `FPS: ${fps.toFixed(2)}`;

        // Reset counters for every second.
        lastTimestamp = currentTimestamp;
        frameCount = 0;
    }

    // Increment frame count
    frameCount++;

}

// Everything that is defined within the scope of the FPS function will be defined as only a local variable for
// the function
//for every call to the fps function: 1) carry forward and keep the values: 1) lastTimeStamp, frameCount
let lastTimestamp = 0;
let frameCount = 0;
let fpsDisplay = document.createElement("div");
document.body.appendChild(fpsDisplay);


// --- FPS --- //


while (true) {
    performance.mark("webgpu start")
    fps()
    device.queue.writeBuffer(ballsBuffer1, 0, jsBallsArray)
    const commandEncoder = device.createCommandEncoder()
    let computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline)
    computePass.setBindGroup(0, bindGroup);
    const numberWorkgroups = Math.ceil(numberOfBalls / 64);
    computePass.dispatchWorkgroups(numberWorkgroups)
    computePass.end()
    commandEncoder.copyBufferToBuffer(ballsBuffer2, 0, ballsBuffer3, 0, memoryForBalls);
    const finished = commandEncoder.finish();
    device.queue.submit([finished])
    await ballsBuffer3.mapAsync(GPUMapMode.READ, 0, memoryForBalls);
    const c = ballsBuffer3.getMappedRange(0, memoryForBalls).slice();
    nextBalls = new Float32Array(c)
    ballsBuffer3.unmap()
    performance.mark("webgpu end")
    performance.measure("webgpu", "webgpu start", "webgpu end")
    toRender !== 0 ? drawBalls(nextBalls) : (v++, canvas.fillStyle = v % 2 === 0 ? "red" : "blue",
        canvas.fillRect(0, 0, canvas.canvas.width, canvas.canvas.height))
    jsBallsArray = nextBalls
    await promiseRequestAnimationFrame()
}

function drawBall(ballsArray, index) {
    const radius = ballsArray[index + 0],
        x = ballsArray[index + 4],
        y = ballsArray[index + 5],
        charge = ballsArray[index + 1]

    // Draw the outer ball
    if (charge === 0) {
        canvas.fillStyle = "#ffffff";
    } else if (charge < 0) {
        canvas.fillStyle = "#bea9de"
    } else {
        canvas.fillStyle = "#131862"
    }

    canvas.beginPath();
    canvas.arc(x, y, radius, 0, 2 * Math.PI, true);
    canvas.closePath();
    canvas.fill();
}

function drawBalls(ballsArray) {
    canvas.save()
    canvas.scale(1, -1)
    canvas.translate(0, -canvas.canvas.height)
    canvas.clearRect(0, 0, canvas.canvas.width, canvas.canvas.height)
    canvas.fillStyle = "red";
    for (let i = numberOfFields; i < ballsArray.length; i += numberOfFields) {
        drawBall(ballsArray, i)
    }
    canvas.fillStyle = "blue";
    drawBall(ballsArray, 0);
    canvas.restore()
}

function randFloat(a, b) {
    return Math.random() * (b - a) + a
}

function randInt(a, b) {
    return Math.round(randFloat(a, b))
}

function randSign(plusProbability) {
    if (plusProbability < 0) {
        return 0;
    }
    if (Math.random() <= plusProbability) {
        return 1;
    } else {
        return -1;
    }
}