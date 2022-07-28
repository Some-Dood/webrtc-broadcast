import { config } from './peer';

async function main() {
    const video = document.getElementById('screen');
    const isVideo = video instanceof HTMLVideoElement;
    if (!isVideo) throw new Error('no video found');

    const peer = new RTCPeerConnection(config);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const ws = new WebSocket(process.env.WS_CLIENT!, 'livestream');
    ws.addEventListener('open', function() {
        // Send over the offer first
        this.send(JSON.stringify(offer));

        let hasAnswer = false;
        this.addEventListener('message', async function({ data }) {
            if (typeof data !== 'string') throw new Error('non-string ICE candidate');

            const init = JSON.parse(data);
            if (hasAnswer) {
                await peer.addIceCandidate(init);
                return;
            }

            // Finish the handshake
            hasAnswer = true;
            await peer.setRemoteDescription(init);

            // Only start sending ice candidates from this point on
            peer.addEventListener('icecandidate', ({ candidate }) => {
                if (candidate === null) throw new Error('null candidate');
                const json = candidate.toJSON();
                this.send(JSON.stringify(json));
            }, { passive: true });

            // And then relay the track to the video
            peer.addEventListener('track', ({ streams }) => {
                console.assert(streams.length === 1);
                video.srcObject = streams[0];
            }, { passive: true, once: true });
        }, { passive: true });
    }, { passive: true, once: true });
}

main();
