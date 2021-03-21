import React, {useEffect, useState, useRef, useContext,createRef} from 'react'
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
    const peersRef = useRef([])
    const socketRef = useRef()
    const otherUsers = useRef([])
    const userStream = useRef()
    const sendChannel = useRef()
    const [text, setText] = useState("");
    const [partnerVideos, setPartnerVideos] = useState({})
    const [messages, setMessages] = useState([])

    useEffect(() => {
            Object.values(partnerVideos).map(video => video.ref.current.srcObject = video.stream)
    }, [partnerVideos])
    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
            userVideo.current.srcObject = stream;
            userStream.current = stream;

            socketRef.current = io.connect("/");
            socketRef.current.emit("join room", props.match.params.roomID);

            socketRef.current.on('other user', users => {
                users.map(userID => {
                    if(!otherUsers.current.includes(userID)) callUser(userID)
                });

                //setPartnerVideos(pvideos => pvideos.splice({id:userID, stream : e.streams[0], ref: createRef() }))

                otherUsers.current = users;
            });

            socketRef.current.on("user joined", userID => {
                otherUsers.current.push(userID);
            });

            socketRef.current.on('user gone', userID => {
                otherUsers.current.splice(otherUsers.current.indexOf(userID),1);
                if(peersRef.current[userID])
                peersRef.current[userID].close()
                delete peersRef.current[userID]

                setPartnerVideos(pvideos =>  {
                    const p = pvideos
                    delete p[userID]
                    return p
                })

                setPartnerVideos(pvideos =>  {
                    const p = {}
        
                    Object.keys(pvideos).map(key => {
                        if(key !== userID)
                            p[key] = pvideos[key]
                    }) 
                    return p
                })
            });            

            socketRef.current.on("offer", handleRecieveCall);

            socketRef.current.on("answer", handleAnswer);

            socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
        });

    }, []);

    function callUser(userID) {
        peersRef.current[userID] = createPeer(userID);
        userStream.current.getTracks().forEach(track => peersRef.current[userID].addTrack(track, userStream.current));
        //sendChannel.current = peersRef.current[userID].createDataChannel('sendChannel')
        //sendChannel.current.onmessage = handleRecieveMessage
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

        peer.onicecandidate = e => handleICECandidateEvent(e, userID);
        peer.ontrack = e => handleTrackEvent(e, userID);
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
        peersRef.current[userID].createOffer().then(offer => {
            return peersRef.current[userID].setLocalDescription(offer)
        }).then(() => {
            const payload = {
                target:userID,
                caller: socketRef.current.id,
                sdp: peersRef.current[userID].localDescription
            }
            socketRef.current.emit('offer', payload)
        }).catch(e => console.log(e))
    }

    function handleRecieveCall(incoming){      
        
        peersRef.current[incoming.caller] = createPeer(incoming.caller)
        /* peerRef.current.ondatachannel = (e) => {
            sendChannel.current = e.channel
            sendChannel.current.onmessage = handleRecieveMessage
        } */

        const desc = new RTCSessionDescription(incoming.sdp)
        peersRef.current[incoming.caller].setRemoteDescription(desc)
        .then(()=> {
            userStream.current.getTracks().forEach(track => peersRef.current[incoming.caller].addTrack(track, userStream.current))
        })
        .then(() => { return peersRef.current[incoming.caller].createAnswer() })
        .then(answer => { return peersRef.current[incoming.caller].setLocalDescription(answer) })
        .then(() => { 
            const payload = {
                target:incoming.caller,
                caller: socketRef.current.id,
                sdp: peersRef.current[incoming.caller].localDescription
            }
            socketRef.current.emit('answer', payload) 
        })
        .catch(e => console.log(e))
    }

    function handleAnswer(message){
        const desc = new RTCSessionDescription(message.sdp)
        peersRef.current[message.caller].setRemoteDescription(desc)
    }

    function handleICECandidateEvent(e,userID) {
        if (e.candidate) {
            const payload = {
                target: userID,
                candidate: e.candidate,
                caller: socketRef.current.id,
            }
            socketRef.current.emit("ice-candidate", payload);
        }
    }

    function handleNewICECandidateMsg(incoming) {
        const candidate = new RTCIceCandidate(incoming.candidate);
        peersRef.current[incoming.caller].addIceCandidate(candidate)
            .catch(e => console.log(e));
    }

    function handleTrackEvent(e,userID){
        setPartnerVideos(pvideos =>  {
            const p = {}

            Object.keys(pvideos).map(key => {
                p[key] = pvideos[key]
            }) 

            p[userID]= {stream : e.streams[0], ref: createRef()}
            return p
        })
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

    let renderVideo = Object.keys(partnerVideos).map(key => {
        return (
            <video width="300" autoPlay ref={partnerVideos[key].ref} key={key} />
        )
    })

    return (
        <div>
            <video width="300" muted autoPlay ref={userVideo} />
            {renderVideo}
        </div>
    )
}

export default Room