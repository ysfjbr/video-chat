import React from 'react'
import { v1 as uuid } from 'uuid'

const CreateRoom = (props) => {
    function Create(){
        const id = uuid()
        props.history.push(`/room/${id}`)
    }


    return (
        <button onClick={Create} >Create room</button>
    )
}

export default CreateRoom