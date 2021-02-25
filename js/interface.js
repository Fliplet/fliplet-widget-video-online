var widgetId = Fliplet.Widget.getDefaultId();
var data = Fliplet.Widget.getData(widgetId) || {};
var TIMEOUT_BUFFER = 1000; // Timeout buffer in ms
var MAX_THUMBNAIL_WIDTH = 800;
var THUMBNAIL_QUALITY = 0.7;
var timer = null;

var $refresh = $('[data-refresh]');
var $showExample = $('#try-stream-single');

// 1. Fired from Fliplet Studio when the external save button is clicked
Fliplet.Widget.onSaveRequest(function() {
  save(true);
});

function save(notifyComplete) {
  Fliplet.Widget.save(data).then(function() {
    if (notifyComplete) {
      Fliplet.Widget.complete();
    } else {
      Fliplet.Studio.emit('reload-widget-instance', widgetId);
    }
  });
}

function oembed(options) {
  options = options || {};

  if (typeof options === 'string') {
    options = {
      url: options
    };
  }

  var params = {
    url: options.url,
    key: '81633801114e4d9f88027be15efb8169',
    autoplay: true
  };

  return $.getJSON('https://api.embedly.com/1/oembed?' + $.param(params))
    .then(function(response) {
      var notSupported = ['video', 'link'].indexOf(response.type) === -1;

      if (response.thumbnail_url) {
        if (!response.width) {
          response.width = response.thumbnail_width;
        }

        if (!response.height) {
          response.height = response.thumbnail_height;
        }
      } else if (options.validateThumbnail) {
        // A size and thumbnail are required to render the output
        return Promise.reject('Video thumbnail not found. Please try again later if the video is recently published.');
      }

      // A size and thumbnail are required to render the output
      if (!response.width || !response.height || notSupported) {
        return Promise.reject('This URL is not supported for online embedding. See <a href="https://embed.ly/providers">https://embed.ly/providers</a> to learn more.');
      }

      return response;
    });
}

$refresh.on('click', function(e) {
  e.preventDefault();
  $('#video_url').trigger('change');
});

$('#video_url, #video_urls').on('input change', function() {
  var url = this.value;

  removeFinalStates();
  $('.video-states .initial').addClass('hidden');
  $('.video-states .loading').addClass('show');
  $refresh.addClass('hidden');


  if ($(this).val().length === 0) {
    $('.video-states .initial').removeClass('hidden');
    $('.video-states .loading').removeClass('show');
    $showExample.removeClass('invisible');
    save();
    return;
  }

  $showExample.addClass('invisible');

  Fliplet.Widget.toggleSaveButton(false);
  clearTimeout(timer);
  timer = setTimeout(function() {
    $('.helper-holder .warning').removeClass('show');
    oembed({
      url: url,
      validateThumbnail: false
    })
      .then(function(response) {
        // No thumbnail found
        if (!response.thumbnail_url && response.url && response.url !== url) {
          // A new URL is given by embedly
          // The original URL might have been a shortened URL
          // Send it to embedly again for processing
          return oembed({
            url: response.url,
            validateThumbnail: true
          });
        }

        return response;
      })
      .then(function(response) {
        // Validate thumbnail_url and convert to Base64 string
        return toDataUrl(response.thumbnail_url)
          .then(function(base64Img) {
            if (response.width > MAX_THUMBNAIL_WIDTH) {
              var width = MAX_THUMBNAIL_WIDTH;
              var height = response.height/response.width * width;

              response.width = width;
              response.height = height;
            }

            return resizeDataURL(base64Img, {
              width: response.width,
              height: response.height
            });
          })
          .then(function(base64ImgResized) {
            response.thumbnail_base64 = base64ImgResized;
            return response;
          });
      })
      .then(function(response) {
        $refresh.removeClass('hidden');

        var bootstrapHtml = '<div class="embed-responsive embed-responsive-{{orientation}}">{{html}}</div>';

        data.orientation = (response.width / response.height > 1.555 ) ? '16by9' : '4by3';
        data.embedly = response;
        data.type = response.type;
        data.url = url;
        data.video_html = bootstrapHtml
          .replace('{{html}}', response.html)
          .replace('{{orientation}}', data.orientation)
          .replace('//cdn', 'https://cdn');
        data.thumbnail_base64 = response.thumbnail_base64;

        if (response.type === 'link') {
          $('.helper-holder .warning').addClass('show');
        }

        changeStates(true);
        save(false);
        Fliplet.Widget.toggleSaveButton(true);
      })
      .catch(function(error) {
        data.html = '';
        changeStates(false, error);
        save(false);
        Fliplet.Widget.toggleSaveButton(true);
      });
  }, TIMEOUT_BUFFER);
});

$('#try-stream-single, #try-stream-multiple').on('click', function() {
  $('#video_url').val('https://vimeo.com/channels/staffpicks/137643804').trigger('change');
});

function changeStates(success, error) {
  $('.video-states .loading').removeClass('show');

  if (success) {
    $('.video-states .success').addClass('show');
  } else {
    $('.video-states .fail').addClass('show');
    $('.helper-holder .error').html(Fliplet.parseError(error, 'Unknown error. Please try again later.')).addClass('show');
  }
}

function removeFinalStates() {
  $([
    '.helper-holder .warning',
    '.helper-holder .error',
    '.video-states .success',
    '.video-states .fail'
  ].join(',')).removeClass('show');
}

// http://stackoverflow.com/a/20285053/1978835
function toDataUrl(url) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.onload = function() {
      if (xhr.status >= 400) {
        reject('Invalid thumbnail');
        return;
      }

      var reader = new FileReader();

      reader.onloadend = function() {
        resolve(reader.result);
      };
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = function(error) {
      reject(error);
    };
    xhr.open('GET', Fliplet.Env.get('apiUrl') + 'v1/communicate/proxy/' + url);
    xhr.setRequestHeader('auth-token', Fliplet.User.getAuthToken());
    xhr.send();
  });
}

function resizeDataURL(data, options) {
  options = options || {};

  return new Promise(function(resolve, reject) {
    // We create an image to receive the Data URI
    var img = document.createElement('img');

    // When the event "onload" is triggered we can resize the image.
    img.onload = function() {
      // We create a canvas and get its context.
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      // We set the dimensions at the wanted size.
      canvas.width = options.width;
      canvas.height = options.height;

      // We resize the image with the canvas method drawImage();
      ctx.drawImage(this, 0, 0, options.width, options.height);

      var dataURI = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY);

      resolve(dataURI);
    };

    img.onerror = function(error) {
      reject(error);
    }

    // We put the Data URI in the image's src attribute
    img.src = data;
  });
}
