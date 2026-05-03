(function () {
  const places = [
    { id: 'de-young',          name: 'de Young Museum',                       address: '50 Hagiwara Tea Garden Dr, San Francisco, CA 94118',  coords: [37.7715, -122.4687], area: 'golden-gate-park' },
    { id: 'legion',            name: 'Legion of Honor',                       address: '100 34th Ave, San Francisco, CA 94121',                coords: [37.7841, -122.5006], area: 'lincoln-park' },
    { id: 'holocaust-memorial',name: 'Holocaust Memorial (George Segal)',     address: 'Lincoln Park, San Francisco, CA 94121',                coords: [37.7838, -122.5000], area: 'lincoln-park' },
    { id: 'sfmoma',            name: 'SFMOMA',                                address: '151 3rd St, San Francisco, CA 94103',                  coords: [37.7857, -122.4011], area: 'yerba-buena' },
    { id: 'moad',              name: 'Museum of the African Diaspora',        address: '685 Mission St, San Francisco, CA 94105',              coords: [37.7858, -122.4024], area: 'yerba-buena' },
    { id: 'berggruen',         name: 'Berggruen Gallery',                     address: '10 Hawthorne St, San Francisco, CA 94105',             coords: [37.7876, -122.3980], area: 'yerba-buena' },
    { id: 'asian-art',         name: 'Asian Art Museum',                      address: '200 Larkin St, San Francisco, CA 94102',               coords: [37.7799, -122.4163], area: 'civic-center' },
    { id: 'davies',            name: 'Davies Symphony Hall',                  address: '201 Van Ness Ave, San Francisco, CA 94102',            coords: [37.7780, -122.4202], area: 'civic-center' },
    { id: 'war-memorial',      name: 'War Memorial Opera House',              address: '301 Van Ness Ave, San Francisco, CA 94102',            coords: [37.7787, -122.4203], area: 'civic-center' },
    { id: 'sfjazz',            name: 'SFJAZZ Center',                         address: '201 Franklin St, San Francisco, CA 94102',             coords: [37.7770, -122.4216], area: 'civic-center' },
    { id: 'msp',               name: 'Minnesota Street Project',              address: '1275 Minnesota St, San Francisco, CA 94107',           coords: [37.7551, -122.3932], area: 'dogpatch' },
    { id: 'mcd',               name: 'Museum of Craft and Design',            address: '2569 3rd St, San Francisco, CA 94107',                 coords: [37.7560, -122.3884], area: 'dogpatch' },
    { id: 'grace',             name: 'Grace Cathedral',                       address: '1100 California St, San Francisco, CA 94108',          coords: [37.7918, -122.4131], area: 'nob-hill' },
    { id: 'silverman',         name: 'Jessica Silverman',                     address: '621 Grant Ave, San Francisco, CA 94108',               coords: [37.7919, -122.4063], area: 'nob-hill' },
    { id: 'fraenkel',          name: 'Fraenkel Gallery',                      address: '49 Geary St #450, San Francisco, CA 94108',            coords: [37.7884, -122.4047], area: 'nob-hill' },
    { id: 'fort-mason',        name: 'Fort Mason Center for Arts & Culture',  address: '2 Marina Blvd, San Francisco, CA 94123',               coords: [37.8062, -122.4317], area: 'marina' },
    { id: 'ferry-building',    name: 'Ferry Building',                        address: '1 Ferry Building, San Francisco, CA 94105',            coords: [37.7956, -122.3933], area: 'ferry-building' },
    { id: 'sausalito',         name: 'Sausalito Ferry Landing',               address: 'Sausalito Ferry Terminal, Sausalito, CA 94965',        coords: [37.8590, -122.4787], area: 'ferry-building' },
    { id: 'sca',               name: 'Sausalito Center for the Arts',         address: '750 Bridgeway, Sausalito, CA 94965',                   coords: [37.8590, -122.4799], area: 'ferry-building' },
    { id: 'filoli',            name: 'Filoli',                                address: '86 Cañada Rd, Woodside, CA 94062',                     coords: [37.4720, -122.3128], area: 'peninsula' },
  ];

  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  function gmapsLink(address) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  }

  function popupHtml(place) {
    return (
      '<span class="pop-name">' + place.name + '</span>' +
      '<span class="pop-addr">' + place.address + '</span>' +
      '<a class="pop-link" href="' + gmapsLink(place.address) + '" target="_blank" rel="noopener">Open in Google Maps</a>'
    );
  }

  function makePin() {
    return L.divIcon({ className: 'pin-wrap', html: '<div class="pin"></div>', iconSize: [22, 22] });
  }

  function buildMap(elementId, list, options) {
    const el = document.getElementById(elementId);
    if (!el || !list.length) return null;

    const map = L.map(el, {
      scrollWheelZoom: false,
      attributionControl: true,
      zoomControl: options && options.zoom !== false,
    });

    L.tileLayer(tileUrl, { attribution: tileAttr, maxZoom: 19 }).addTo(map);

    const markers = {};
    list.forEach(function (p) {
      const m = L.marker(p.coords, { icon: makePin(), title: p.name })
        .addTo(map)
        .bindPopup(popupHtml(p), { offset: [0, -6], closeButton: true, autoPan: true });
      markers[p.id] = m;
    });

    if (list.length === 1) {
      map.setView(list[0].coords, 14);
    } else {
      const bounds = L.latLngBounds(list.map(function (p) { return p.coords; }));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }

    // Reveal scroll-zoom only after the map gains focus, so casual scrolling
    // through the page doesn't get stuck on the map.
    map.on('focus', function () { map.scrollWheelZoom.enable(); });
    map.on('blur',  function () { map.scrollWheelZoom.disable(); });
    el.addEventListener('mouseleave', function () { map.scrollWheelZoom.disable(); });

    return { map: map, markers: markers };
  }

  function init() {
    if (typeof L === 'undefined') return;

    // Main map: every place except the Peninsula (kept on its own map for
    // sensible zoom).
    const cityPlaces = places.filter(function (p) { return p.area !== 'peninsula'; });
    const main = buildMap('map-all', cityPlaces);

    // Per-area mini-maps. The peninsula gets its own scoped map.
    const areas = {};
    places.forEach(function (p) { (areas[p.area] = areas[p.area] || []).push(p); });
    const areaMaps = {};
    Object.keys(areas).forEach(function (areaId) {
      const m = buildMap('map-' + areaId, areas[areaId]);
      if (m) areaMaps[areaId] = m;
    });

    // Click on a stop in the prose: open the corresponding pin in the
    // section's mini-map. (Doesn't override links inside the stop.)
    document.querySelectorAll('.stops > li[data-stop]').forEach(function (li) {
      li.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        const stopId = li.getAttribute('data-stop');
        const place = places.find(function (p) { return p.id === stopId; });
        if (!place) return;
        const areaMap = areaMaps[place.area];
        if (!areaMap) return;
        const marker = areaMap.markers[stopId];
        if (!marker) return;
        marker.openPopup();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
