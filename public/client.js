let userName;
let roomName;

const input = $("input[name='txt-msg']");
const messageBody = $(".message-body");
const classUser = $(".user");
const socket = io();
const MAX_FILE_SIZE = 18 * 1024 * 1024;

socket.on('connect', addUser);
socket.on('updateusers', updateUserList);

function addUser() {
    userName = prompt("Enter your Name!");
    roomName = prompt("Enter your room name!");
    socket.emit('adduser', userName, roomName);
}

input.on('keyup', function (e) {
    if (e.key === 'Enter') {
        sendMessage(e.target.value);
    }
});

function sendMessage(message) {
    let msg = {
        user: userName,
        message: message.trim()
    };
    appendMessage(msg, 'outgoing');
    input.val('');
    goDown();
    socket.emit('message', msg);
}

function appendMessage(msg, type) {
    let newDiv = $('<div>').addClass(type + ' message');
    $('<h4>').text(msg.user || 'Unknown').appendTo(newDiv);
    $('<p>').text(msg.message || '').appendTo(newDiv);
    messageBody.append(newDiv);
}

function goDown() {
    messageBody.scrollTop(messageBody[0].scrollHeight);
}

function sendClick() {
    var message = input.val();
    sendMessage(message);
}

socket.on('message', (msg) => {
    appendMessage(msg, 'incoming');
    goDown();
});

socket.on('greeting', (data) => {
    let msg = {
        user: "Server",
        message: "Welcome " + data + "! You have been connected."
    };
    appendMessage(msg, 'incoming');
    goDown();
});

function updateUserList(data) {
    classUser.empty();
    $('.room').html(roomName);
    $.each(data, function (key, value) {
        if (key.endsWith(roomName)) {
            let newSpan = $('<span>').addClass('online-user').html(`<i class="fa-solid fa-circle-user" aria-hidden="true"></i><sub class="on_off"></sub>`);
            newSpan.find('.on_off').text(value);
            classUser.append(newSpan);
        }
    });
}

$('#imageInput').on('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
        alert('Please choose a file smaller than 18 MB.');
        $(this).val('');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const data = reader.result;
        socket.emit('uploadFileV2', data, file.name, file.type || 'application/octet-stream');
        appendFile({ data, fileName: file.name, mimeType: file.type, user: userName }, 'outgoing');
        $('#imageInput').val('');
    };
    reader.onerror = () => {
        alert('Could not read this file. Please try again.');
        $('#imageInput').val('');
    };
    reader.readAsDataURL(file);
});

function appendFile(file, type) {
    const message = $('<div>').addClass(type + ' message');
    $('<h4>').text(file.user || 'Unknown').appendTo(message);
    const mimeType = file.mimeType || '';
    if (mimeType.startsWith('image/')) {
        $('<img>').attr({ src: file.data, alt: file.fileName || 'Shared image', tabindex: 0 })
            .addClass('uploadedImage').on('click keydown', function (event) {
                if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openImagePreview(file.data, file.fileName);
                }
            }).appendTo(message);
    } else if (mimeType.startsWith('video/')) {
        $('<video>').attr({ src: file.data, controls: true, preload: 'metadata' }).addClass('shared-media').appendTo(message);
    } else if (mimeType.startsWith('audio/')) {
        $('<audio>').attr({ src: file.data, controls: true, preload: 'metadata' }).addClass('shared-media').appendTo(message);
    } else {
        const download = $('<a>').attr({ href: file.data, download: file.fileName || 'download' })
            .addClass('file-download');
        $('<i>').addClass('fa-solid fa-file-arrow-down').attr('aria-hidden', 'true').appendTo(download);
        $('<span>').text(file.fileName || 'Download file').appendTo(download);
        download.appendTo(message);
    }
    messageBody.append(message);
    goDown();
}

function openImagePreview(src, alt) {
    $('.lightbox-image').attr({ src, alt: alt || 'Full-size image preview' });
    $('.image-lightbox').prop('hidden', false);
}

function closeImagePreview() {
    $('.image-lightbox').prop('hidden', true);
    $('.lightbox-image').attr('src', '');
}

$('.lightbox-close').on('click', closeImagePreview);
$('.image-lightbox').on('click', function (event) {
    if (event.target === this) closeImagePreview();
});
$(document).on('keydown', event => {
    if (event.key === 'Escape') closeImagePreview();
});

socket.on('publishFile', (data, user, fileName, mimeType) => {
    // Accept both the current positional event and the object format used by an intermediate version.
    const file = data && typeof data === 'object'
        ? data
        : { data, user, fileName, mimeType };
    appendFile(file, 'incoming');
});
socket.on('publishImage', (data, user) => {
    appendFile({ data, user, fileName: 'Shared image', mimeType: 'image/*' }, 'incoming');
});
