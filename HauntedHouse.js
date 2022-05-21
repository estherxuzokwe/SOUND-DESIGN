// include recorder only for developing and testing
// var recorder;
var context = new AudioContext;
let output = new GainNode(context);
output.connect(context.destination);

// global parameters
// eqGain array stores gains for 10 biquad filters, init with -12
var eqGain = [-12, -12, -12, -12, -12, -12, -12, -12, -12, -12];
// mouse position x,y over picture (0,..,1), -1 when mouse is not over picture, init with -1
var mousePositionX = -1;
var mousePositionY = -1;
// noise level for wind
var noiseLevel = 0.2;

// global variables
// nodesCreated flag, true when audio nodes for wind noise has been created, init with false
var nodesCreated = false;
// last random value r which represents the key of the last played note, init with -1
var rLast = -1;

// global constants
// frequencies for all 10 filters
var eqFreq = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
// q factor for peaking biquad filters, bandwidth: 1 octave
var qFactor = 1.414214;
// fade amount for fade in and out (will be added or subtracted to noiseLevel every 40 ms)
var fadeAmount = 0.001;
// ratio of a semi tone
var semitoneRatio = Math.pow(2, 1 / 12);

// web audio api objects
// eq array for all 10 biquad filter instances
var eq = new Array(10);
// noiseGain (wind)
var noiseGain;
// convolver node (reverb)
var convolver = context.createConvolver();
// delay node (reverb)
var delayNode = context.createDelay(1);
// feedback gain (reverb)
var feedBackGain = context.createGain();
// buffer node for reverb impulse response
var irBuffer;
// buffer node for karplus strong audio
var karplusStrongBuffer;


// *** create noise buffer (100 sec with random values) *** 
// buffer size = samplerate * 100
const noiseBufferSize = context.sampleRate * 100;
// create buffer with 1 channel
let noiseBuffer = context.createBuffer(1, noiseBufferSize, context.sampleRate);
// get data channel of the buffer
let data = noiseBuffer.getChannelData(0);
// set random values in the data array
for (let i = 0; i < noiseBufferSize; i++) {
  data[i] = Math.random() * 2 - 1;
};

// create XMLHttp request and load impulse response
request1 = new XMLHttpRequest();
request1.open('GET', 'IR/VeryLargeAmbience.wav', true);
request1.responseType = 'arraybuffer';

// decode request audio data
request1.onload = function () {
  let audioData = request1.response;
  context.decodeAudioData(audioData, function (buffer) {
    // set irBuffer
    irBuffer = buffer;
    // link irBuffer to convolver node
    convolver.buffer = irBuffer;
    // connect nodes
    convolver.connect(output);
    convolver.connect(delayNode);
    delayNode.connect(feedBackGain);
    // set delay time
    delayNode.delayTime.value = 0.5;
    // set feedback gain
    feedBackGain.gain.value = 0.2;
    // connect feedbackGain node with convolver node
    feedBackGain.connect(convolver);
  }, function (e) { "Error with decoding audio data" + e.err });
}
// send request
request1.send();

// create XMLHttp request and load karplus strong audio recording
request2 = new XMLHttpRequest();
request2.open('GET', 'audio/KarplusStrongCut.wav', true);
request2.responseType = 'arraybuffer';

// decode request audio data
request2.onload = function () {
  let audioData = request2.response;
  context.decodeAudioData(audioData, function (buffer) {
    // set karplusStrong buffer
    karplusStrongBuffer = buffer;
  }, function (e) { "Error with decoding audio data" + e.err });
}
// send request
request2.send();

// call back when picture is clicked
Haunted.onclick = function clickEvent(e) {
  context.resume();

  // create source with karplus strong buffer
  let source = context.createBufferSource();
  source.buffer = karplusStrongBuffer;
  // random integer value r (0,..,11) represents key of the melody
  let r
  do {
    r = Math.floor(12 * Math.random());
    // compute random value r while r is not the same value as last time 
  } while (r === rLast);
  rLast = r;
  // set playback rate to key ratio depending on r
  source.playbackRate.value = 1 * Math.pow(semitoneRatio, r);;
  // connect nodes and start source
  source.connect(convolver);
  source.connect(output);
  source.start();

  // create two additional oscillators
  let osc = context.createOscillator();
  let osc2 = context.createOscillator();
  // set frequencies of oscillators to basic frequency multiplied with key ratio depending on r
  osc.frequency.value = 87 * Math.pow(semitoneRatio, r);
  osc2.frequency.value = 130 * Math.pow(semitoneRatio, r);
  // create gain for oscillator level
  let oscGain = context.createGain();
  oscGain.gain.value = 0.2;
  // set release to 4 sec 
  oscGain.gain.linearRampToValueAtTime(0, context.currentTime + 4);
  // connect nodes and start oscillators
  osc.connect(oscGain);
  osc2.connect(oscGain);
  oscGain.connect(convolver);
  oscGain.connect(output);
  osc.start(0);
  osc2.start(0);
}

// call back when mouse is moved over picture
Haunted.onmousemove = function (e) {
  context.resume();
  // compute mouse position relative to picture
  let rect = e.target.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  let width = rect.right - rect.left
  let height = rect.bottom - rect.top;
  // set mousePositionX and mousePositionY parameter to relative mouse position in the range (0,..,1)
  mousePositionX = x / width;
  mousePositionY = y / height;
}

// call back when mouse leaves picture
Haunted.onmouseout = function () {
  // set mousePositionX and mousePositionY parameter to -1
  mousePositionX = -1;
  mousePositionY = -1;
}

// mouse listener is called every 40 ms and computes gain and eq settings for wind noise 
// depending on x,y position of the mouse relative to picture
function mouseListener() {
  if (nodesCreated) {
    let newGainValue;
    if (mousePositionX >= 0) {
      // mouse is over picture
      // compute noiseLevel dependong on y position
      noiseLevel = (1 - mousePositionY) * 0.2;
      // fade in
      newGainValue = noiseGain.gain.value + fadeAmount;
      if (newGainValue > noiseLevel) newGainValue = noiseLevel;
    } else {
      // mouse is not over picture
      // fade out
      newGainValue = noiseGain.gain.value - fadeAmount;
      if (newGainValue < 0) newGainValue = 0;
    };
    // set new gain value to noiseGain
    noiseGain.gain.value = newGainValue;


    if (mousePositionX >= 0) {
      // mouse is over picture
      // compute eq gain values depending on x position
      let eqPositionX = mousePositionX * 10;
      let eqCurve = new Array(10);
      for (let i = 0; i < 10; i++) {
        // use square function f(x) = a * (x*x) + c, where x is eqPositionX
        let a = -1.5;
        let c = 20;
        let eqDistance = i - eqPositionX;
        eqCurve[i] = a * eqDistance * eqDistance + c;

        eqGain[i] = Math.pow(10, (eqCurve[i] / 20));
      }

      // set eq gain values
      for (let i = 0; i < 10; i++) {
        eq[i].gain.value = eqGain[i];
      };
    };
  };
}

function startWind() {
  context.resume();
  // create 8 peaking biquad filters, set frequency, q factor and gain
  for (let i = 1; i < 9; i++) {
    eq[i] = context.createBiquadFilter();
    eq[i].type = "peaking";
    eq[i].frequency.value = eqFreq[i];
    eq[i].Q.value = qFactor;
    eq[i].gain.value = 0;
  };
  // create a lowshelf biquad filter, set frequency and gain
  eq[0] = context.createBiquadFilter();
  eq[0].type = "lowshelf";
  eq[0].frequency.value = eqFreq[0];
  eq[0].gain.value = 0;
  // create a highshelf biquad filter, set frequency and gain
  eq[9] = context.createBiquadFilter();
  eq[9].type = "highshelf";
  eq[9].frequency.value = eqFreq[9];
  eq[9].gain.value = 0;

  // create source with noiseBuffer;
  let source = context.createBufferSource();
  source.buffer = noiseBuffer;
  // loop source for endless noise
  source.loop = true;
  // create noise gain
  noiseGain = context.createGain();
  // set initial noise gain to 0
  noiseGain.gain.value = 0;
  // connect nodes
  source.connect(noiseGain);
  // connect all filters in series
  noiseGain.connect(eq[0]);
  for (i = 0; i < 9; i++) {
    eq[i].connect(eq[i + 1]);
  };
  eq[9].connect(output);
  // start source
  source.start(0);
  // set noiseCreated flag true
  nodesCreated = true;

}

// start wind noise
startWind();
// activate mouse listener
setInterval(mouseListener, 40);

// include recording only for developing and testing
/*
recorder = new Recorder(output) //change output to whichever node you want to record
Start.onclick = () => {
  context.resume()
  recorder.record()
}
Stop.onclick = () => {
  recorder.stop()
  recorder.exportWAV(blob => document.querySelector("audio").src = URL.createObjectURL(blob))
}
*/
