const url = `https://apis.map.qq.com/ws/geocoder/v1/?address=北京市故宫博物院&key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77`;

fetch(url)
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
