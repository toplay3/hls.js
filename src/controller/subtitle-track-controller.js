/*
 * audio track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';

class SubtitleTrackController extends EventHandler {

  constructor(hls) {
    super(hls, Event.MANIFEST_LOADING,
               Event.MANIFEST_LOADED,
               Event.SUBTITLE_TRACK_LOADED);
    this.tracks = [];
    this.trackId = 0;
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onManifestLoading() {
    // reset subtitle tracks on manifest loading
    this.tracks = [];
    this.trackId = 0;
  }

  onManifestLoaded(data) {
    let tracks = data.subtitles || [];
    let defaultFound = false;
    this.tracks = tracks;
    this.trackId = -1;
    this.hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, {subtitleTracks : tracks});

    // loop through available subtitle tracks and autoselect default if needed
    // TODO: improve selection logic to handle forced, etc
    tracks.forEach(track => {
      if(track.default) {
        this.subtitleTrack = track.id;
        defaultFound = true;
        return;
      }
    });
  }

  onSubtitleTrackLoaded(data) {
    if (data.id < this.tracks.length) {
      logger.log(`subtitle track ${data.id} loaded`);
      this.tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  /** get alternate subtitle tracks list from playlist **/
  get subtitleTracks() {
    return this.tracks;
  }

  /** get index of the selected subtitle track (index in subtitle track lists) **/
  get subtitleTrack() {
   return this.trackId;
  }

  /** select a subtitle track, based on its index in subtitle track lists**/
  set subtitleTrack(subtitleTrackId) {
    if (this.trackId !== subtitleTrackId) {// || this.tracks[subtitleTrackId].details === undefined) {
      this.setSubtitleTrackInternal(subtitleTrackId);
    }
  }

 setSubtitleTrackInternal(newId) {
    // check if level idx is valid
    if (newId >= 0 && newId < this.tracks.length) {
      // stopping live reloading timer if any
      if (this.timer) {
       clearInterval(this.timer);
       this.timer = null;
      }
      this.trackId = newId;
      logger.log(`switching to subtitle track ${newId}`);
      let subtitleTrack = this.tracks[newId];
      this.hls.trigger(Event.SUBTITLE_TRACK_SWITCH, {id: newId});
       // check if we need to load playlist for this subtitle Track
      let details = subtitleTrack.details;
      if (details === undefined || details.live === true) {
        // track not retrieved yet, or live playlist we need to (re)load it
        logger.log(`(re)loading playlist for subtitle track ${newId}`);
        this.hls.trigger(Event.SUBTITLE_TRACK_LOADING, {url: subtitleTrack.url, id: newId});
      }
    }
  }
}

export default SubtitleTrackController;