import React, {useEffect, useState, useRef} from 'react'
import io from 'socket.io-client'
import styled from "styled-components";
 

const Container = styled.div`
    height: 100vh;
    width: 50%;
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const Messages = styled.div`
    width: 100%;
    height: 60%;
    border: 1px solid black;
    margin-top: 10px;
    overflow: scroll;
`;

const MessageBox = styled.textarea`
    width: 100%;
    height: 30%;
`;

const Button = styled.div`
    width: 50%;
    border: 1px solid black;
    margin-top: 15px;
    height: 5%;
    border-radius: 5px;
    cursor: pointer;
    background-color: black;
    color: white;
    font-size: 18px;
`;

const MyRow = styled.div`
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
`;

const MyMessage = styled.div`
  width: 45%;
  background-color: blue;
  color: white;
  padding: 10px;
  margin-right: 5px;
  text-align: center;
  border-top-right-radius: 10%;
  border-bottom-right-radius: 10%;
`;

const PartnerRow = styled(MyRow)`
  justify-content: flex-start;
`;

const PartnerMessage = styled.div`
  width: 45%;
  background-color: grey;
  color: white;
  border: 1px solid lightgray;
  padding: 10px;
  margin-left: 5px;
  text-align: center;
  border-top-left-radius: 10%;
  border-bottom-left-radius: 10%;
`;

const Room = (props) => {
    
    const userVideo = useRef()
    const partnerVideo = useRef()
    const peerRef = useRef()
    const socketRef = useRef()
    const otherUser = useRef()
    const userStream = useRef()
    const sendChannel = useRef()
    const [text, setText] = useState("");
    const [messages, setMessages] = useState([])

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
            userVideo.current.srcObject = stream;
            userStream.current = stream;

            socketRef.current = io.connect("/");
            socketRef.current.emit("join room", props.match.params.roomID);

            socketRef.current.on('other user', userID => {
                callUser(userID);
                otherUser.current = userID;
            });

            socketRef.current.on("user joined", userID => {
                otherUser.current = userID;
            });

            socketRef.current.on("offer", handleRecieveCall);

            socketRef.current.on("answer", handleAnswer);

            socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
        });

    }, []);

    function callUser(userID) {
        peerRef.current = createPeer(userID);
        userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current));
        sendChannel.current = peerRef.current.createDataChannel('sendChannel')
        sendChannel.current.onmessage = handleRecieveMessage
    }

    function createPeer(userID) {
        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.stunprotocol.org"
                },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'yousef',
                    username: 'ysf_jbr@msn.com'
                },
            ]
        });

        peer.onicecandidate = handleICECandidateEvent;
        peer.ontrack = handleTrackEvent;
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

        return peer;
    }

    function handleRecieveMessage(e){
        setMessages(messages => [ ...messages, { yours: false, value: e.data}])
    }

    function sendMessage(){
        sendChannel.current.send(text)
        setMessages(messages => [ ...messages, { yours: true, value: text}])
    }

    function handleChange(e) {
        setText(e.target.value);
    }

    function handleNegotiationNeededEvent(userID){
        peerRef.current.createOffer().then(offer => {
            return peerRef.current.setLocalDescription(offer)
        }).then(() => {
            const payload = {
                target:userID,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            }
            socketRef.current.emit('offer', payload)
        }).catch(e => console.log(e))
    }

    function handleRecieveCall(incoming){
        peerRef.current = createPeer()
        peerRef.current.ondatachannel = (e) => {
            sendChannel.current = e.channel
            sendChannel.current.onmessage = handleRecieveMessage
        }

        const desc = new RTCSessionDescription(incoming.sdp)
        peerRef.current.setRemoteDescription(desc)
        .then(()=> {
            userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current))
        })
        .then(() => { return peerRef.current.createAnswer() })
        .then(answer => { return peerRef.current.setLocalDescription(answer) })
        .then(() => { 
            const payload = {
                target:incoming.caller,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            }
            socketRef.current.emit('answer', payload) 
        })
        .catch(e => console.log(e))
    }

    function handleAnswer(message){
        const desc = new RTCSessionDescription(message.sdp)
        peerRef.current.setRemoteDescription(desc)
    }

    function handleICECandidateEvent(e) {
        if (e.candidate) {
            const payload = {
                target: otherUser.current,
                candidate: e.candidate,
            }
            socketRef.current.emit("ice-candidate", payload);
        }
    }

    function handleNewICECandidateMsg(incoming) {
        const candidate = new RTCIceCandidate(incoming);

        peerRef.current.addIceCandidate(candidate)
            .catch(e => console.log(e));
    }

    function handleTrackEvent(e){
        partnerVideo.current.srcObject = e.streams[0]
    }

    function renderMessage(message, index) {
        if (message.yours) {
            return (
                <MyRow key={index}>
                    <MyMessage>
                        {message.value}
                    </MyMessage>
                </MyRow>
            )
        }

        return (
            <PartnerRow key={index}>
                <PartnerMessage>
                    {message.value}
                </PartnerMessage>
            </PartnerRow>
        )
    }

    return (
        <div>
            <video autoPlay ref={userVideo} />
            <video autoPlay ref={partnerVideo} />

            <Messages>
                {messages.map(renderMessage)}
            </Messages>
            <MessageBox value={text} onChange={handleChange} placeholder="Say something....." />
            <Button onClick={sendMessage}>Send..</Button>
        </div>
    )
}

export default Room