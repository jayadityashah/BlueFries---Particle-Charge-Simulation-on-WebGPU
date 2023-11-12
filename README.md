# BlueFries---Particle-Charge-Simulation-on-WebGPU
 By editing the properties of the particles, simulation can be performed with high performance using WebGPU. The following proof of concept shows so:
 
Live demo link with WebGPU: https://jayadityashah.github.io/BlueFries_ParticleChargeSimulation-on-WebGPU/?balls=600&width=1400&height=650

Live demo Without Web GPU: https://jayadityashah.github.io/BlueFries_ParticleChargeSimulation-WOGPU/?balls=2000&width=1400&height=650

repository for w/o gpu: https://github.com/jayadityashah/BlueFries_ParticleChargeSimulation-WOGPU


You can edit the following parameters, by passing them to the url above by using the ?tag:

balls parameter - number of balls

min/max_radius parameter - min and max particle radius

plus_probability - the probability of the particle to have a +1 charge. if -1, all particles are neutral

width, height - width and height of the canvas

A key on the particle color and charges:

White - neutral

Dark Blue - positive

Pink - Negetive

(Charges behave so simmilars attract for the demo but this can be changed by changing the charge co-relation to negetive in the wgsl file)
