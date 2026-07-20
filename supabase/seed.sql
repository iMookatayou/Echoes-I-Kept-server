begin;

insert into public.categories (id, name, slug)
values
  (1, 'Pop', 'pop'),
  (2, 'Alternative', 'alternative'),
  (3, 'R&B', 'r-and-b')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug;

insert into public.posts (
  id,
  category_id,
  artist,
  best_pick,
  spotify_url,
  image_url,
  detail_image_url,
  detail_image_position,
  title,
  description,
  content,
  status,
  author_name,
  author_avatar_url,
  author_bio,
  published_at,
  created_at,
  updated_at
)
values
  (
    1,
    2,
    $seed$Billie Eilish$seed$,
    $seed$Birds of a Feather$seed$,
    $seed$https://open.spotify.com/track/6dOtVTDdiauQNBQEDOtlAB$seed$,
    $seed$/music-covers/Billie_Eilish.webp$seed$,
    $seed$/music-covers/Billie_Eilish_Wallpaper.webp$seed$,
    $seed$center$seed$,
    $seed$Billie Eilish: Quiet Intensity and Birds of a Feather$seed$,
    $seed$A personal look at Billie Eilish, the intimacy in her sound, and why Birds of a Feather is my best pick.$seed$,
    $seed$1. About Billie Eilish

Billie Eilish has a rare ability to make a huge pop song feel private. Her voice can be soft and close, but the emotion behind it never feels small. Alongside Finneas, she has built a sound that values atmosphere, unusual details, and honest feelings over predictable pop formulas.

2. What Makes Her Different

The thing I enjoy most about Billie is contrast. A restrained vocal can sit beside heavy production, and a vulnerable thought can become the center of a confident song. Her music works through headphones because every small sound feels intentional.

3. My Best Pick: Birds of a Feather

Birds of a Feather is my best Billie Eilish pick. It is warmer and more open than much of her darker material, yet it still carries the intimacy that makes her music recognizable. The melody feels immediate without losing its emotional weight.

4. Why It Stays With Me

I return to this song because it captures devotion without making the feeling complicated. It is bright, sincere, and easy to live with. Among Billie's songs, this is the one that best balances her distinctive voice with a timeless pop feeling.$seed$,
    'published',
    'Techin B.',
    '/avatars/anime.jpg',
    array[$seed$I write about the artists whose music stays with me, from polished pop and alternative moods to after-dark R&B.$seed$, $seed$Each article begins with the artist and ends with my best pick: the song I keep returning to and why it matters to me.$seed$],
    $seed$2026-06-20T00:00:00.000Z$seed$,
    $seed$2026-06-20T00:00:00.000Z$seed$,
    $seed$2026-06-20T00:00:00.000Z$seed$
  ),
  (
    2,
    1,
    $seed$Charlie Puth$seed$,
    $seed$We Don't Talk Anymore$seed$,
    $seed$https://open.spotify.com/track/06KyNuuMOX1ROXRhj787tj$seed$,
    $seed$/music-covers/Charlie_Puth.webp$seed$,
    $seed$/music-covers/Charlie_Puth_Wallpaper.webp$seed$,
    $seed$center$seed$,
    $seed$Charlie Puth: Pop Precision and We Don't Talk Anymore$seed$,
    $seed$Charlie Puth turns musical precision into effortless pop. We Don't Talk Anymore is the song I keep returning to.$seed$,
    $seed$1. About Charlie Puth

Charlie Puth is a songwriter, producer, and vocalist with an unusually sharp ear for melody. His music often sounds effortless, but behind that ease is a musician who pays close attention to harmony, rhythm, and the tiny production choices that make a chorus memorable.

2. The Craft Behind the Pop

What makes Charlie interesting to me is how clearly he understands pop structure. He can turn a simple emotional situation into a polished song without removing the awkwardness or uncertainty that made the story relatable in the first place.

3. My Best Pick: We Don't Talk Anymore

We Don't Talk Anymore is my best Charlie Puth pick. The song captures the strange distance that can appear between two people who once knew everything about each other. Its light, tropical production contrasts with the discomfort at the center of the story.

4. Why It Stays With Me

This is the Charlie Puth song I revisit most because it sounds calm while carrying unresolved emotion. The duet format makes the separation feel mutual, and the melody remains instantly recognizable. It is polished pop with a very human silence underneath it.$seed$,
    'published',
    'Techin B.',
    '/avatars/anime.jpg',
    array[$seed$I write about the artists whose music stays with me, from polished pop and alternative moods to after-dark R&B.$seed$, $seed$Each article begins with the artist and ends with my best pick: the song I keep returning to and why it matters to me.$seed$],
    $seed$2026-06-19T00:00:00.000Z$seed$,
    $seed$2026-06-19T00:00:00.000Z$seed$,
    $seed$2026-06-19T00:00:00.000Z$seed$
  ),
  (
    3,
    2,
    $seed$The Neighbourhood$seed$,
    $seed$Reflections$seed$,
    $seed$https://open.spotify.com/track/2xql0pid3EUwW38AsywxhV$seed$,
    $seed$/music-covers/The_Neighbourhood.webp$seed$,
    $seed$/music-covers/The_Neighbourhood_Wallpaper.webp$seed$,
    $seed$center$seed$,
    $seed$The Neighbourhood: Monochrome Mood and Reflections$seed$,
    $seed$The Neighbourhood built a world of nocturnal alternative pop, and Reflections is the track that represents it best for me.$seed$,
    $seed$1. About The Neighbourhood

The Neighbourhood blends alternative rock, pop, and R&B into music that feels inseparable from its visual identity. Their black-and-white presentation is more than styling; it matches songs filled with distance, desire, insecurity, and late-night overthinking.

2. A Sound Built for the Night

I like how their music creates space. Guitars, slow rhythms, and Jesse Rutherford's restrained delivery make even direct emotions feel hazy. Their best songs do not rush to explain themselves, which gives the listener room to attach personal memories.

3. My Best Pick: Reflections

Reflections is my best pick from The Neighbourhood. It carries the band's familiar atmosphere while feeling especially inward-looking. The production is smooth and spacious, and the song moves like a thought that keeps circling back.

4. Why It Stays With Me

This track works for me because it captures the moment when memory and reality become difficult to separate. It is ideal for quiet nights and long journeys. Reflections feels less like a performance and more like being left alone with a thought.$seed$,
    'published',
    'Techin B.',
    '/avatars/anime.jpg',
    array[$seed$I write about the artists whose music stays with me, from polished pop and alternative moods to after-dark R&B.$seed$, $seed$Each article begins with the artist and ends with my best pick: the song I keep returning to and why it matters to me.$seed$],
    $seed$2026-06-18T00:00:00.000Z$seed$,
    $seed$2026-06-18T00:00:00.000Z$seed$,
    $seed$2026-06-18T00:00:00.000Z$seed$
  ),
  (
    4,
    1,
    $seed$Taylor Swift$seed$,
    $seed$Daylight$seed$,
    $seed$https://open.spotify.com/track/1fzAuUVbzlhZ1lJAx9PtY6$seed$,
    $seed$/music-covers/Taylor_Swift.webp$seed$,
    $seed$/music-covers/Taylor_Swift_Wallpaper.webp$seed$,
    $seed$center$seed$,
    $seed$Taylor Swift: Storytelling That Reaches Daylight$seed$,
    $seed$Taylor Swift has made storytelling the center of her career. Daylight is the song that brings her growth into focus for me.$seed$,
    $seed$1. About Taylor Swift

Taylor Swift's greatest strength is the way she turns specific memories into stories that feel shared. Across country, pop, folk, and alternative sounds, the details change but the writing remains central. Her albums often feel like chapters in a longer emotional life.

2. Growth Through Storytelling

I enjoy how Taylor revisits familiar subjects from new perspectives. Love, regret, ambition, and identity are not fixed themes in her work; they evolve as she does. That continuity gives listeners a reason to grow alongside the music.

3. My Best Pick: Daylight

Daylight is my best Taylor Swift pick. It closes an album shaped by anxiety with a feeling of clarity. The song is not simply about finding love; to me, it is about choosing a healthier way to understand it.

4. Why It Stays With Me

I come back to Daylight because it feels earned. Its warmth arrives after uncertainty, which makes the hope believable. It is a reminder that a person can outgrow old definitions and decide what deserves to guide the next chapter.$seed$,
    'published',
    'Techin B.',
    '/avatars/anime.jpg',
    array[$seed$I write about the artists whose music stays with me, from polished pop and alternative moods to after-dark R&B.$seed$, $seed$Each article begins with the artist and ends with my best pick: the song I keep returning to and why it matters to me.$seed$],
    $seed$2026-06-17T00:00:00.000Z$seed$,
    $seed$2026-06-17T00:00:00.000Z$seed$,
    $seed$2026-06-17T00:00:00.000Z$seed$
  ),
  (
    5,
    1,
    $seed$Katy Perry$seed$,
    $seed$The One That Got Away$seed$,
    $seed$https://open.spotify.com/track/63DKmLTYzYqET9IDXMV95I$seed$,
    $seed$/music-covers/Katy_Perry.webp$seed$,
    $seed$/music-covers/Katy_Perry_Wallpaper.webp$seed$,
    $seed$center$seed$,
    $seed$Katy Perry: Big Pop Feelings and The One That Got Away$seed$,
    $seed$Behind Katy Perry's colorful pop is an instinct for emotional clarity. The One That Got Away is my favorite example.$seed$,
    $seed$1. About Katy Perry

Katy Perry is known for bright concepts, enormous choruses, and pop songs that immediately understand their own identity. Beneath the color and spectacle, her strongest work often depends on direct emotions that need very little explanation.

2. More Than the Big Choruses

What I appreciate about Katy is her commitment to a feeling. Whether a song is playful, triumphant, or sad, she performs it without hesitation. That confidence is why her pop records can feel both theatrical and personal.

3. My Best Pick: The One That Got Away

The One That Got Away is my best Katy Perry pick. It steps away from pure celebration and focuses on memory, timing, and the future that never happened. The production stays accessible, but the emotional idea grows heavier with every return.

4. Why It Stays With Me

I like this song because it treats regret with tenderness rather than drama. It understands that some relationships remain important even when they cannot continue. Among Katy's hits, this is the one that feels most reflective and lasting to me.$seed$,
    'published',
    'Techin B.',
    '/avatars/anime.jpg',
    array[$seed$I write about the artists whose music stays with me, from polished pop and alternative moods to after-dark R&B.$seed$, $seed$Each article begins with the artist and ends with my best pick: the song I keep returning to and why it matters to me.$seed$],
    $seed$2026-06-16T00:00:00.000Z$seed$,
    $seed$2026-06-16T00:00:00.000Z$seed$,
    $seed$2026-06-16T00:00:00.000Z$seed$
  ),
  (
    6,
    3,
    $seed$The Weeknd$seed$,
    $seed$Lost in the Fire$seed$,
    $seed$https://open.spotify.com/track/2vXKRlJBXyOcvZYTdNeckS$seed$,
    $seed$/music-covers/Gesaffelstein_The_Weeknd.webp$seed$,
    $seed$/music-covers/Gesaffelstein_The_Weeknd_Wallpaper.webp$seed$,
    $seed$center 35%$seed$,
    $seed$The Weeknd: After-Dark R&B and Lost in the Fire$seed$,
    $seed$The Weeknd made darkness feel cinematic. His Gesaffelstein collaboration Lost in the Fire is my best pick from that world.$seed$,
    $seed$1. About The Weeknd

The Weeknd helped move alternative R&B into the center of pop without losing its shadows. His music combines a polished voice with stories about desire, isolation, excess, and consequences. Even at his most accessible, there is usually something uneasy beneath the surface.

2. A Cinematic After-Dark World

I enjoy the scale of his music. Synths, bass, and dramatic production turn a private conflict into a scene that feels built for city lights at midnight. His collaborations often work best when the producer understands that tension.

3. My Best Pick: Lost in the Fire

Lost in the Fire, his collaboration with Gesaffelstein, is my best pick from this side of The Weeknd's music. The production is dark, controlled, and immediately recognizable. His vocal sits against the electronic backdrop with exactly the right amount of distance.

4. Why It Stays With Me

This is the track I choose because its atmosphere arrives instantly. It feels sleek and dangerous without becoming chaotic. For me, Lost in the Fire captures the after-dark character that first made The Weeknd's music so compelling.$seed$,
    'published',
    'Techin B.',
    '/avatars/anime.jpg',
    array[$seed$I write about the artists whose music stays with me, from polished pop and alternative moods to after-dark R&B.$seed$, $seed$Each article begins with the artist and ends with my best pick: the song I keep returning to and why it matters to me.$seed$],
    $seed$2026-06-15T00:00:00.000Z$seed$,
    $seed$2026-06-15T00:00:00.000Z$seed$,
    $seed$2026-06-15T00:00:00.000Z$seed$
  )
on conflict (id) do update set
  category_id = excluded.category_id,
  artist = excluded.artist,
  best_pick = excluded.best_pick,
  spotify_url = excluded.spotify_url,
  image_url = excluded.image_url,
  detail_image_url = excluded.detail_image_url,
  detail_image_position = excluded.detail_image_position,
  title = excluded.title,
  description = excluded.description,
  content = excluded.content,
  status = excluded.status,
  author_name = excluded.author_name,
  author_avatar_url = excluded.author_avatar_url,
  author_bio = excluded.author_bio,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at;

select setval(
  pg_get_serial_sequence('public.categories', 'id'),
  greatest((select max(id) from public.categories), 1),
  true
);

select setval(
  pg_get_serial_sequence('public.posts', 'id'),
  greatest((select max(id) from public.posts), 1),
  true
);

commit;
