// Photos from Unsplash (unsplash.com, free to use under the Unsplash License).
// Sample imagery for the prototype only — real listings must use the owner's own photos.

export type Photo = { src: string; alt: string; credit: string };

const u = (id: string) => `https://images.unsplash.com/photo-${id}`;

export const HERO_PHOTO: Photo = { src: u("1596564309076-01c1868b07a4"), alt: "Aerial view of Metro Manila high-rise buildings in daylight", credit: "OJ Serrano" };
export const GATE_PHOTO: Photo = { src: u("1623518761090-089a985ab17f"), alt: "City skyline at night", credit: "Joe Barbour" };
export const VERIFY_PHOTO: Photo = { src: u("1512428559087-560fa5ceab42"), alt: "Person holding a smartphone", credit: "NordWood Themes" };
export const SKYLINE_PHOTO: Photo = { src: u("1586012480859-cf3571524b8d"), alt: "City skyline under white clouds", credit: "Rey Melvin Caraan" };

export const LISTING_PHOTOS: Record<string, Photo[]> = {
  "bgc-uptown-1br": [
    { src: u("1649429710616-dad56ce9a076"), alt: "Living room with furniture and a large window", credit: "sophie peng" },
    { src: u("1630699375019-c334927264df"), alt: "Bedroom with a white bed and throw pillows", credit: "Point3D Commercial Imaging" },
    { src: u("1603072819161-e864800276cd"), alt: "White and wood kitchen cabinets", credit: "Blake Woolwine" },
  ],
  "rockwell-2br": [
    { src: u("1560185009-5bf9f2849488"), alt: "Bright living room interior", credit: "Francesca Tosolini" },
    { src: u("1560448075-57d0285fc59b"), alt: "Bedroom with comforter and bedside lamps", credit: "Francesca Tosolini" },
    { src: u("1611095210561-67f0832b1ca3"), alt: "Dining table with white and grey chairs", credit: "Francesca Tosolini" },
  ],
  "ortigas-studio": [
    { src: u("1652882860902-7c6b0f88ef23"), alt: "Studio with a neatly made bed and a desk", credit: "MAHZA D'BRATA" },
    { src: u("1609766857326-18a204c2cf31"), alt: "Grey couch and round wooden table", credit: "Lotus Design N Print" },
    { src: u("1612320582827-a95ab2596dbc"), alt: "Bed with white linen and pillows", credit: "Huy Nguyen" },
  ],
  "alabang-house": [
    { src: u("1580587771525-78b9dba3b914"), alt: "White and brown two-storey house under blue sky", credit: "Yaroslav Alekseenko" },
    { src: u("1512917774080-9991f1c4c750"), alt: "House beside a swimming pool", credit: "Frames For Your Heart" },
    { src: u("1560185007-5f0bb1866cab"), alt: "Grey sofa and wooden coffee table", credit: "Francesca Tosolini" },
  ],
  "cebu-itpark-1br": [
    { src: u("1603072845032-7b5bd641a82a"), alt: "White and brown living room set", credit: "Blake Woolwine" },
    { src: u("1560448205-4d9b3e6bb6db"), alt: "Bed with green and white pillows", credit: "Francesca Tosolini" },
    { src: u("1597285952775-1382215fbff0"), alt: "High-rise buildings in daytime", credit: "Alexes Gerard" },
  ],
  "qc-maginhawa-2br": [
    { src: u("1625283518755-6047df2fb180"), alt: "White townhouse beside a road", credit: "Simi Iluyomade" },
    { src: u("1560185127-6ed189bf02f4"), alt: "Living room interior", credit: "Francesca Tosolini" },
    { src: u("1618247500327-c2976255fed1"), alt: "White house near green trees", credit: "ellen O" },
  ],
};

export const listingPhotos = (id: string): Photo[] => LISTING_PHOTOS[id] ?? [SKYLINE_PHOTO];
