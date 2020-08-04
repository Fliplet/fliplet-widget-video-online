Fliplet.Widget.instance('video-online', function(data) {
  var $el = $(this);

  $el.parents('[data-widget-package="com.fliplet.online-video"]').addClass('focus-outline');

  $el.find('img')
    .on('click keydown', function(event) {
      if (event.type === 'keydown' && event.keyCode !== 13 && event.keyCode !== 32) {
        return;
      }

      if (Fliplet.Navigator.isOnline()) {
        Fliplet.Analytics.trackEvent({
          category: 'video',
          action: 'load_stream_online',
          label: data.url
        });

        if (data.type === 'link') {
          Fliplet.Navigate.url(data.embedly.url);
          return;
        }
        $el.html(data.video_html);

        // initialize the player.
        var player = new playerjs.Player($el.find('iframe.embedly-embed')[0]);
        // Wait for the player to be ready.
        player.on(playerjs.EVENTS.READY, function() {
          if (player.supports('event', playerjs.EVENTS.PLAY)) {
            player.on(playerjs.EVENTS.PLAY, function() {
              Fliplet.Analytics.trackEvent({
                category: 'video',
                action: 'play_stream',
                label: data.url
              });
            });
          }

          if (player.supports('event', playerjs.EVENTS.PAUSE)) {
            player.on(playerjs.EVENTS.PAUSE, function() {
              Fliplet.Analytics.trackEvent({
                category: 'video',
                action: 'pause_stream',
                label: data.url
              });
            });
          }
        });
      } else {
        Fliplet.Analytics.trackEvent({
          category: 'video',
          action: 'load_stream_offline',
          label: data.url
        });

        Fliplet.Navigate.popup({
          popupTitle: 'Internet Unavailable',
          popupMessage: 'This video requires Internet to play. Please try again when Internet is available.'
        });
      }
    });
});
