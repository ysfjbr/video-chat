import React, {useEffect, useState, useRef, useContext,createRef} from 'react'
import io from 'socket.io-client'
import styled from "styled-components";
 

const Container = styled.div`
    width: 100%;
    margin: auto;
    flex-direction: column;
    align-items: left;
`;

const Videos = styled.div`
    width: calc(100% - 400px);
    height: 100%;
`;

const Video = styled.div`
    border-radius: 5px;
    margin: 10px;
`;

const MChat = styled.div`
    width:  400px;
    position: fixed;
    height: 100%;
    border-left: 1px solid black;
    right:0;
    top:0;
`;

const Messages = styled.div`
    width: 100%;
    height: 60%;
    margin-top: 10px;
    overflow: scroll;
`;

const MessageBox = styled.textarea`
    width: 100%;
    height: 30%;
`;

const Button = styled.div`
    border-radius: 5px;
    cursor: pointer;
    background-color: black;
    color: white;
    font-size: 18px;
    padding: 10px;
    margin: 10px;
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
`;

const Room = (props) => {
    
    const userVideo = useRef()    
    const peersRef = useRef([])
    const socketRef = useRef()
    const otherUsers = useRef([])
    
    const userStream = useRef()
    const [text, setText] = useState("");
    const [partnerVideos, setPartnerVideos] = useState({})
    const [sendChannels, setSendChannels] = useState({})
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

        setSendChannels(channels => {
            const p = {}

            Object.keys(channels).map(key => {
                p[key] = channels[key]
            }) 

            p[userID]= peersRef.current[userID].createDataChannel('sendChannel')
            p[userID].onmessage = handleRecieveMessage
            return p
        })
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
        console.log("msssfg", e.data);
        setMessages(messages => [ ...messages, { yours: false, value: e.data}])
    }

    function sendMessage(){
        //console.log(sendChannels.length);
        Object.keys(sendChannels).map(key => sendChannels[key].send(text))
        setMessages(messages => [ ...messages, { yours: true, value: text}])
        setText("");
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

        peersRef.current[incoming.caller].ondatachannel = (e) => {
            setSendChannels(channels => {
                const p = {}
    
                Object.keys(channels).map(key => {
                    p[key] = channels[key]
                }) 
    
                p[incoming.caller]= e.channel
                p[incoming.caller].onmessage = handleRecieveMessage
                return p
            })
        }

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
                <video className="video" width="300" autoPlay ref={partnerVideos[key].ref} key={key} />
        )
    })

    return (
        <Container>
            <Videos>
                <video className="video" width="300" muted autoPlay ref={userVideo} />
                {renderVideo}
            </Videos>
            <MChat>
                <Messages>
                    {messages.map(renderMessage)}
                </Messages>
                <MessageBox value={text} onChange={handleChange} placeholder="Say something....." />
                <Button onClick={sendMessage}>Send..</Button>
            </MChat>
        </Container>

    )
}

export default Room