// const path = require('path');
// const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const moment = require('moment');
var cors = require('cors')

const { isRealString } = require('./utils/isRealString');
const { Users } = require('./utils/users');

const port = process.env.PORT || 3000
let app = express();
app.use(cors())
const server = app.listen(port, () => {
    console.log(`server running on port ${port}`);
});


let i = 1;

let io = socketIO(server);
let users = new Users();

io.on('connection', (socket) => {
    console.log("A new user just connected");
    socket.on('add_user', (data, callback) => {
        let user = users.getUserId(data.userId);
        if(user){
            users.removeUser(user.id);
            users.addNewUser(socket.id, data.name, data.room, data.userId, data.isOnline, data.status);
            let dataNew = { id: socket.id, name: data.name, room: data.room, userId: data.userId, isOnline: data.isOnline, status: data.status }
            io.emit("visitors", { status: "join", users: users.getUsers(), join: dataNew, left: null });
            socket.emit('heartbeat', { status: "join", users: users.getUsers(), join: dataNew, left: null });
            return callback({ status: "Added", users: users.getUsers(), add: dataNew, left: null, m_tabs: true })
        }else{
            users.addNewUser(socket.id, data.name, data.room, data.userId, data.isOnline, data.status);
            let dataNew = { id: socket.id, name: data.name, room: data.room, userId: data.userId, isOnline: data.isOnline, status: data.status }
            socket.emit('heartbeat', { status: "join", users: users.getUsers(), join: dataNew, left: null });
            io.emit("visitors", { status: "join", users: users.getUsers(), join: dataNew, left: null });
            return callback({ status: "Added", users: users.getUsers(), add: dataNew, left: null, m_tabs: true  });
        }
    });

    socket.on('update_user', (data, callback) => {
        users.removeUser(socket.id);
        users.addNewUser(socket.id, data.name, data.room, data.userId, data.isOnline, data.status);
        let dataNew = { id: socket.id, name: data.name, room: data.room, userId: data.userId, isOnline: data.isOnline, status: data.status }
        io.emit("visitors", { status: "update", users: users.getUsers(), join: dataNew, left: null });
        socket.emit('heartbeat', { status: "update", users: users.getUsers(), join: dataNew, left: null });
        return callback({ status: "Updated", users: users.getUsers(), add: dataNew, left: null })
    })

    socket.on('join', (data, callback) => {
        if (!isRealString(data.name)) {
            return callback('Name and room are required');
        } else {
            socket.join(data.room);
            users.removeUser(socket.id);
            users.addUser(socket.id, data.name, data.room, data.userId, data.isOnline, data.status);
            let dataNew = { id: socket.id, name: data.name, room: data.room, userId: data.userId, isOnline: data.isOnline, status: data.status }
            socket.emit('heartbeat', { status: "join_room", users: users.getUsers(), join: dataNew, left: null });
            io.emit("visitors", { status: "join_room", users: users.getUsers(), join: dataNew, left: null });
            // io.to(data.room).emit('updateUsersList', users.getUserList(data.room));
            return callback({ status: "join", users: users.getUsers() });
        }
    });

    socket.on('messageToUser', (data, callback) => {
        console.log("messageToUser", data);
        let date = moment().valueOf()
        let user = users.getUserId(data.receiver)
        if (user) {
            io.to(user.id).emit('messageToUser',
                {
                    message: data.message,
                    receiver: data.receiver,
                    myId: data.myId,
                    createdAt: date,
                    isSeen: false,
                    name: data.name
                });
            return callback({ status: "sent" });
        } else {
            return callback({ status: "failed", message: "User Not Online" });
        }
    })

    socket.on('callToUser', (data, callback) => {
        let user = users.getUserId(data.userId)
        let dr = users.getUserId(data.myId)
        console.log('callToUser', user, dr)
        if (user) {
            io.to(user.id).emit('callToUser', { status: "success", message: "Incoming Call form Dr "+dr.name, appointmentId: data.appointmentId, call: true })
            return callback({ status: "success", message: "Sending Call", call: true })
        } else{
            // io.to(dr.id).emit('callToUser', { status: "failed", message: "User Not Found", call: false })
            return callback({ status: "failed", message: "Patient is not online.", call: false })
        }
    })

    socket.on('callToDr', (data, callback) => {
        let user = users.getUserId(data.myId);
        let dr = users.getUserId(data.drId);
        console.log('callToDr', data, user, dr)
        if (dr) {
            io.to(dr.id).emit('callToDr', { status: "success", message: user.name, appointmentId: data.appointmentId, call: false })
            return callback({ status: "success", message: "Doctor Informed", call: false })
        } else {
            if(user){
                io.to(user.id).emit('callToDr', { status: "failed", message: "User Not Found", call: false })
                return callback({ status: "failed", message: "User Not Found", call: false })
            }
        }
    });

    socket.on('callStatus', (data) => {
        let user = users.getUserId(data.drId);
        console.log('callStatus', user);
        if (user) {
            io.to(user.id).emit('callStatus',
                {
                    status: "failed",
                    message: "Outgoing Call Failed. User Permissions Issue.",
                    call: false
                });
            // return callback({ status: "informed" })
        }
    });

    socket.on('getUserStatus', (data, callback) => {
        let user = users.getUserId(data.userId);
        console.log('getUserStatus', user);
        if (user) {
            io.to(socket.id).emit('getUserStatus', { isOnline: true, user: user })
            return callback({ isOnline: true, user: user })
        } else {
            io.to(socket.id).emit('getUserStatus', { isOnline: false })
            return callback({ isOnline: false })
        }
    });

    socket.on('removeMe', (callback) => {
        let user = users.removeUser(socket.id);
        if(user){
            let dataNew = { id: '', name: user.name, room: user.room, userId: user.userId, isOnline: false, status: 'Offline' }
            socket.emit('heartbeat', { status: "left", users: users.getUsers(), join: null, left: dataNew });
        }
        // console.log(`User seems offline ${socket.id}`);
        // let user = users.getUserId(socket.id);
        //data = {userId, myId}
        // let user = users.getUserId(data.myId)
        // console.log('user in getUserStatus', user)
        // if (user) {
        //     io.to(socket.id).emit('removeMe', { isOnline: true, user: user })
        // } else {
        //     io.to(socket.id).emit('getUserStatus', { isOnline: false })
        // }
    });

    socket.on("imOnline", (callback) => {
        // let user = null;//users.getUserId(data.userId);
        // if(!user){
        //     users.addNewUser(socket.id, data.name, data.room, data.userId, data.isOnline, data.status);
        //     let dataNew = { id: socket.id, name: data.name, room: data.room, userId: data.userId, isOnline: data.isOnline, status: data.status }
        //     io.emit("visitors", { status: "join", users: users.getUsers(), join: dataNew, left: null });
        //     return callback({ status: "Added", users: users.getUsers(), add: dataNew, left: null, m_tabs: true  });
        // }else{
        //     return callback({ users: users.getUsers() });
        // }
    });

    setInterval(function() {
        let us = users.getUsers();
        // console.log("heartbeat", us, us.length);
        if(us.length > 0 ){
            socket.emit('heartbeat', { status: null, users: us, join: null, left: null });
        }
    }, 30 *1000);

    socket.on('disconnect', () => {
        console.log(`User seems offline ${socket.id}`);
        setTimeout(function () {
            console.log(`After waiting 15 sec ${socket.id}`);
            let user = users.removeUser(socket.id);
            if (user) {
                if (user.room !== "") {
                    io.to(user.room).emit('updateUsersList', users.getUserList(user.room));
                    let dataNew = { id: '', name: user.name, room: user.room, userId: user.userId, isOnline: false, status: 'Offline' }
                    io.emit("visitors", { status: "left", users: users.getUsers(), join: 'null', left: dataNew });
                    socket.emit('heartbeat', { status: "left", users: users.getUsers(), join: null, left: dataNew });
                    // io.emit("visitors", users.getUsers());
                    io.emit("getUserStatus", { isOnline: false, user: user });
                } else {
                    io.emit("visitors", users.getUsers());
                    socket.emit('heartbeat', { status: "left", users: users.getUsers(), join: null, left: null });
                }
            }
        }, 15 * 1000);
    });
});

// server.listen(port, () => {
//   console.log(`Server is up on port ${port}`);
// })
