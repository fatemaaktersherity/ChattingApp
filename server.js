const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const appServer = createServer(app);
// Socket.IO's default payload limit is too small for most media files.
const io = new Server(appServer, { maxHttpBufferSize: 25 * 1024 * 1024 });
const usernames = {};

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/indexchat.html");
});

io.on('connection', (socket) => {
    console.log('User Connected...');
    
    socket.on('message', (msg) => {
        if (!socket.room) return;
        socket.to(socket.room).emit('message', { ...msg, user: socket.username });
    });
    
    socket.on('adduser', (username, roomname) => {
        socket.join(roomname);
        socket.room = roomname;
        socket.username = username;
        usernames[username + "_" + roomname] = username;
        io.sockets.in(socket.room).emit('updateusers', usernames);
        socket.emit('greeting', username);
    });
    
    const publishFile = (data, fileName, mimeType) => {
        if (!socket.room || typeof data !== 'string' || typeof fileName !== 'string') return;
        // Keep the original positional event shape for tabs that still have older client.js cached.
        socket.to(socket.room).emit('publishFile', data, socket.username, fileName.slice(0, 255), mimeType);
    };

    const getMimeType = (fileName) => ({
        zip: 'application/zip',
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4'
    }[fileName.split('.').pop().toLowerCase()] || 'application/octet-stream');

    // Compatibility with the original client: uploadFile(data, username, fileName).
    socket.on('uploadFile', (data, _username, fileName) => {
        if (typeof fileName === 'string') publishFile(data, fileName, getMimeType(fileName));
    });

    socket.on('uploadFileV2', (data, fileName, mimeType) => {
        publishFile(data, fileName, typeof mimeType === 'string' ? mimeType.slice(0, 100) : getMimeType(fileName || ''));
    });

    // Support older tabs that still send images on their separate event.
    socket.on('uploadImage', (data, _username) => {
        if (socket.room && typeof data === 'string') {
            socket.to(socket.room).emit('publishImage', data, socket.username);
        }
    });
    
    socket.on('disconnect', () => {
        console.log("User Disconnected");
        delete usernames[socket.username + '_' + socket.room];
        socket.leave(socket.room);
        socket.to(socket.room).emit('updateusers', usernames);
    });
});

appServer.listen(1000, () => {
    console.log("server is running at http://localhost:1000");
});
