(async () => {
  const video = document.getElementById("video");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  const pc1 = new RTCPeerConnection();
  const pc2 = new RTCPeerConnection();

  stream.getTracks().map((track) => {
    pc1.addTrack(track, stream);
  });

  pc1.onicecandidate = ({ candidate }) => {
    candidate && pc2.addIceCandidate(candidate);
  };

  pc2.onicecandidate = ({ candidate }) => {
    candidate && pc1.addIceCandidate(candidate);
  };
  pc2.ontrack = (track) => {
    video.srcObject = track.streams[0];
  };

  await pc1.setLocalDescription(await pc1.createOffer());
  await pc2.setRemoteDescription(pc1.localDescription);
  await pc2.setLocalDescription(await pc2.createAnswer());
  await pc1.setRemoteDescription(pc2.localDescription);
})();
