const videoFrom = document.getElementById("videoFrom");
const videoSFU = document.getElementById("videoSFU");
const videoTo = document.getElementById("videoTo");
const btnStart = document.getElementById("btnStart");
const cryptoKey = "1234567890";

btnStart.addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  // pcFrom -> SFU --RTP-- SFU -> pcTo 으로
  // 전달되므로 총 4개의 PC가 필요합니다.
  const option = {
    encodedInsertableStreams: true,
  };
  const pcFrom = new RTCPeerConnection(option);
  const pcSFUIngress = new RTCPeerConnection();
  const pcSFUEgress = new RTCPeerConnection(option);
  const pcTo = new RTCPeerConnection(option);

  // FROM to SFU
  videoFrom.srcObject = stream;

  stream.getTracks().map((track) => {
    pcFrom.addTrack(track, stream);
  });

  pcFrom.onicecandidate = ({ candidate }) => {
    candidate && pcSFUIngress.addIceCandidate(candidate);
  };

  pcFrom.getSenders().forEach((sender) => {
    const senderStream = sender.createEncodedStreams();
    const { readableStream, writableStream } = senderStream;
    const transformStream = new TransformStream({
      transform: enDecoder,
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
  });

  pcSFUIngress.onicecandidate = ({ candidate }) => {
    candidate && pcFrom.addIceCandidate(candidate);
  };
  // Ingress에서는 Decode하지 않음
  pcSFUIngress.ontrack = (track) => {
    videoSFU.srcObject = track.streams[0];
  };

  await pcFrom.setLocalDescription(await pcFrom.createOffer());
  await pcSFUIngress.setRemoteDescription(pcFrom.localDescription);
  await pcSFUIngress.setLocalDescription(await pcSFUIngress.createAnswer());
  await pcFrom.setRemoteDescription(pcSFUIngress.localDescription);

  // SFU -> TO
  stream.getTracks().map((track) => {
    pcSFUEgress.addTrack(track, stream);
  });
  pcSFUEgress.onicecandidate = ({ candidate }) => {
    candidate && pcTo.addIceCandidate(candidate);
  };

  pcSFUEgress.getSenders().forEach((sender) => {
    const senderStream = sender.createEncodedStreams();
    const { readableStream, writableStream } = senderStream;
    const transformStream = new TransformStream({
      transform: enDecoder,
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
  });

  pcTo.onicecandidate = ({ candidate }) => {
    candidate && pcSFUEgress.addIceCandidate(candidate);
  };

  pcTo.ontrack = (event) => {
    let receiverStreams = event.receiver.createEncodedStreams();
    const { readableStream, writableStream } = receiverStreams;
    const transformStream = new TransformStream({
      transform: enDecoder,
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);

    videoTo.srcObject = event.streams[0];
  };
  await pcSFUEgress.setLocalDescription(await pcSFUEgress.createOffer());
  await pcTo.setRemoteDescription(pcSFUEgress.localDescription);
  await pcTo.setLocalDescription(await pcTo.createAnswer());
  await pcSFUEgress.setRemoteDescription(pcTo.localDescription);
});

function enDecoder(encodedFrame, controller) {
  const frameTypeToCryptoOffset = {
    key: 10,
    delta: 3,
    undefined: 1,
  };
  const view = new DataView(encodedFrame.data);
  const newData = new ArrayBuffer(encodedFrame.data.byteLength);
  const newView = new DataView(newData);
  const cryptoOffset = frameTypeToCryptoOffset[encodedFrame.type];

  for (let i = 0; i < cryptoOffset; ++i) {
    newView.setInt8(i, view.getInt8(i));
  }
  for (let i = cryptoOffset; i < encodedFrame.data.byteLength; ++i) {
    const keyByte = cryptoKey.charCodeAt(i % cryptoKey.length);
    newView.setInt8(i, view.getInt8(i) ^ keyByte);
  }
  encodedFrame.data = newData;
  controller.enqueue(encodedFrame);
}
