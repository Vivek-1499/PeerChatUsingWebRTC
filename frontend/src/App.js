// App.js
import "./App.css";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import {
  Assignment,
  Phone,
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  CallEnd,
} from "@mui/icons-material";
import Peer from "simple-peer";
import io from "socket.io-client";
import { useEffect, useRef, useState } from "react";

const socket = io.connect("http://localhost:5000");

function App() {
  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [copied, setCopied] = useState(false);

  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  const ringtoneRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      });

    socket.on("me", (id) => setMe(id));

    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
      // if (ringtoneRef.current) ringtoneRef.current.play();
    });
  }, []);
  useEffect(() => {
  const handleBeforeUnload = () => {
    if (connectionRef.current) connectionRef.current.destroy();
    socket.emit("endCall", { to: caller || idToCall });
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [caller, idToCall]);


  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = remoteStream;
      }
    });

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    if (ringtoneRef.current) ringtoneRef.current.pause();
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = remoteStream;
      }
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach((track) => track.stop());
    setStream(null);
    window.location.reload();
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled((prev) => !prev);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled((prev) => !prev);
      }
    }
  };

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#0d0c1d" : "#fdfdfd";
  }, [darkMode]);

  return (
    <div className={`app-container ${darkMode ? "dark" : "light"}`}>
      <div className="header">
        <h1 className="title">PeerChat</h1>
        <FormControlLabel
          control={
            <Switch
              checked={darkMode}
              onChange={() => setDarkMode(!darkMode)}
            />
          }
          label="Dark Mode"
        />
      </div>

      <div className="container">
        <div className="video-wrapper">
          <video
            playsInline
            muted
            ref={myVideo}
            autoPlay
            className="video-player"
            style={{ visibility: stream ? "visible" : "hidden" }}
          />
          <div className="controls">
            <IconButton onClick={toggleVideo}>
              {videoEnabled ? <Videocam /> : <VideocamOff />}
            </IconButton>
            <IconButton onClick={toggleAudio}>
              {audioEnabled ? <Mic /> : <MicOff />}
            </IconButton>
          </div>
        </div>

        {callAccepted && !callEnded && (
          <div className="video-wrapper">
            <video
              playsInline
              ref={userVideo}
              autoPlay
              className="video-player"
            />
          </div>
        )}
      </div>

      <div className="myId">
        <TextField
          label="Name"
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={copied ? "✓" : <Assignment />}
          onClick={() => {
            navigator.clipboard.writeText(me);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}>
          {copied ? "Copied" : "Copy ID"}
        </Button>

        <TextField
          label="ID to call"
          variant="outlined"
          value={idToCall}
          onChange={(e) => setIdToCall(e.target.value)}
        />
        {callAccepted && !callEnded ? (
          <Button
            variant="contained"
            color="error"
            startIcon={<CallEnd />}
            onClick={leaveCall}>
            End Call
          </Button>
        ) : (
          <IconButton
            color="success"
            aria-label="call"
            onClick={() => callUser(idToCall)}>
            <Phone fontSize="large" />
          </IconButton>
        )}
      </div>

      {receivingCall && !callAccepted && (
        <div className="caller-modal">
          <h2>{name} is calling...</h2>
          <Button variant="contained" color="primary" onClick={answerCall}>
            Answer
          </Button>
        </div>
      )}

      <audio
        ref={ringtoneRef}
        src="https://cdn.pixabay.com/audio/2022/03/15/audio_41b8b0c5d3.mp3"
        preload="auto"
      />
    </div>
  );
}

export default App;
