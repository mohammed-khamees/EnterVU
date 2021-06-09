import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import io from 'socket.io-client';
import styled from 'styled-components';

const socket = io.connect('https://backenders-devecafe.herokuapp.com');

const Container = styled.div`
	padding: 20px;
	display: flex;
	height: 100vh;
	width: 90%;
	margin: auto;
	flex-wrap: wrap;
`;

const StyledVideo = styled.video`
	height: 10rem;
	width: 10rem;
`;

const Video = (props) => {
	const ref = useRef();

	useEffect(() => {
		props.peer.on('stream', (stream) => {
			ref.current.srcObject = stream;
		});
	}, []);

	return <StyledVideo playsInline autoPlay ref={ref} />;
};

const videoConstraints = {
	height: window.innerHeight / 2,
	width: window.innerWidth / 2,
};

const Room = ({ meetingId }) => {
	const [peers, setPeers] = useState([]);
	const userVideo = useRef();
	const peersRef = useRef([]);
	const roomID = meetingId;

	useEffect(() => {
		navigator.mediaDevices
			.getUserMedia({ video: videoConstraints, audio: true })
			.then((stream) => {
				userVideo.current.srcObject = stream;
				socket.emit('join room', roomID);
				socket.on('all users', (users) => {
					const peers = [];
					users.forEach((userID) => {
						const peer = createPeer(userID, socket.id, stream);
						peersRef.current.push({
							peerID: userID,
							peer,
						});
						peers.push(peer);
					});
					setPeers(peers);
				});

				socket.on('user joined', (payload) => {
					const peer = addPeer(payload.signal, payload.callerID, stream);
					peersRef.current.push({
						peerID: payload.callerID,
						peer,
					});

					setPeers((users) => [...users, peer]);
				});

				socket.on('receiving returned signal', (payload) => {
					const item = peersRef.current.find((p) => p.peerID === payload.id);
					item.peer.signal(payload.signal);
				});
			});
	}, []);

	function createPeer(userToSignal, callerID, stream) {
		const peer = new Peer({
			initiator: true,
			trickle: false,
			stream,
		});

		peer.on('signal', (signal) => {
			socket.emit('sending signal', {
				userToSignal,
				callerID,
				signal,
			});
		});

		return peer;
	}

	function addPeer(incomingSignal, callerID, stream) {
		const peer = new Peer({
			initiator: false,
			trickle: false,
			stream,
		});

		peer.on('signal', (signal) => {
			socket.emit('returning signal', { signal, callerID });
		});

		peer.signal(incomingSignal);

		return peer;
	}

	return (
		<Container>
			<StyledVideo muted ref={userVideo} autoPlay playsInline />
			{peers.map((peer, index) => {
				return <Video key={index} peer={peer} />;
			})}
		</Container>
	);
};

export default Room;
