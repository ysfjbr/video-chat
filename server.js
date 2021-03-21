const express = require('express')
const http = require('http')
const app = express()
const server = http.createServer(app)
const socket = require('socket.io')
const io = socket(server)

const port = 8000

const rooms = {}

io.on('connection', socket => {
    socket.on('join room', roomID => {
        if(rooms[roomID]){
            rooms[roomID].push(socket.id)
        }else{
            rooms[roomID] = [socket.id]
        }
        emitOtherUsers(roomID,'user joined')
    })

    socket.on('offer', payload => {
        io.to(payload.target).emit('offer', payload)
    })

    socket.on('answer', payload => {
        io.to(payload.target).emit('answer', payload)
    })

    socket.on('ice-candidate', incoming => {
        io.to(incoming.target).emit('ice-candidate', {candidate : incoming.candidate, caller: incoming.caller })
    })

    socket.on("disconnect", Disconnect )

    function emitOtherUsers(roomID, type){
        const otherUser = rooms[roomID].filter(id => id !== socket.id);
    
        if(otherUser){
            socket.emit('other user', otherUser)
            otherUser.map(user => socket.to(user).emit(type, socket.id))            
        }
    }

    function Disconnect(){
        Object.keys(rooms).map(roomID => {
            if(rooms[roomID].includes(socket.id))
            {
                rooms[roomID].splice(rooms[roomID].indexOf(socket.id), 1)
            }

            emitOtherUsers(roomID, 'user gone')
        })
    }

})


server.listen(port, () => console.log('Server is running on '+port ))