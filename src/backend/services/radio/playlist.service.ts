import { v4 as uuidv4 } from "uuid";
import { kdb } from "../../infrastructure/db";

export async function getCategories() {
  const categories = await kdb("radio_categories").orderBy("sort_order", "asc").orderBy("created_at", "desc");

  const catIds = categories.map((c: any) => c.id);
  const playlistCounts: Record<string, number> = {};
  if (catIds.length > 0) {
    const counts = await kdb("radio_playlists").whereIn("category_id", catIds).groupBy("category_id").select("category_id").count("* as count");
    counts.forEach((r: any) => { playlistCounts[r.category_id] = Number(r.count); });
  }

  return categories.map((cat: any) => ({
    id: cat.id, name: cat.name, description: cat.description || "",
    cover_image: cat.cover_image || "", sort_order: cat.sort_order,
    is_active: !!cat.is_active, playlist_count: playlistCounts[cat.id] || 0,
    created_at: cat.created_at,
  }));
}

export async function createCategory(data: any, userId: string) {
  const { name, description, cover_image } = data;
  const id = uuidv4();
  const [maxSort] = await kdb("radio_categories").max("sort_order as mx");
  await kdb("radio_categories").insert({
    id, name: name.trim(), description: description?.trim() || null,
    cover_image: cover_image?.trim() || null, sort_order: (maxSort?.mx ?? -1) + 1,
    created_by: userId, created_at: new Date(), updated_at: new Date(),
  });
  return { id };
}

export async function updateCategory(categoryId: string, data: any) {
  const cat = await kdb("radio_categories").where({ id: categoryId }).first();
  if (!cat) throw Object.assign(new Error("Category not found"), { statusCode: 404 });

  const { name, description, cover_image, is_active, sort_order } = data;
  const update: any = { updated_at: new Date() };
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (cover_image !== undefined) update.cover_image = cover_image || null;
  if (is_active !== undefined) update.is_active = is_active ? 1 : 0;
  if (sort_order !== undefined) update.sort_order = sort_order;

  await kdb("radio_categories").where({ id: categoryId }).update(update);
}

export async function deleteCategory(categoryId: string) {
  const cat = await kdb("radio_categories").where({ id: categoryId }).first();
  if (!cat) throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  await kdb("radio_playlists").where({ category_id: categoryId }).update({ category_id: null });
  await kdb("radio_categories").where({ id: categoryId }).del();
}

export async function getPlaylists(categoryId?: string) {
  let query = kdb("radio_playlists").orderBy("created_at", "desc");
  if (categoryId) query = query.where({ category_id: categoryId });
  const playlists = await query;

  const plIds = playlists.map((p: any) => p.id);
  const itemCounts: Record<string, number> = {};
  if (plIds.length > 0) {
    const counts = await kdb("radio_playlist_items").whereIn("playlist_id", plIds).groupBy("playlist_id").select("playlist_id").count("* as count");
    counts.forEach((r: any) => { itemCounts[r.playlist_id] = Number(r.count); });
  }

  return playlists.map((pl: any) => ({
    id: pl.id, name: pl.name, description: pl.description || "",
    category_id: pl.category_id || "", cover_image: pl.cover_image || "",
    is_active: !!pl.is_active, item_count: itemCounts[pl.id] || 0,
    created_at: pl.created_at,
  }));
}

export async function createPlaylist(data: any, userId: string) {
  const { name, description, category_id, cover_image } = data;
  const id = uuidv4();
  await kdb("radio_playlists").insert({
    id, name: name.trim(), description: description?.trim() || null,
    category_id: category_id || null, cover_image: cover_image || null,
    created_by: userId, created_at: new Date(), updated_at: new Date(),
  });
  return { id };
}

export async function updatePlaylist(playlistId: string, data: any) {
  const playlist = await kdb("radio_playlists").where({ id: playlistId }).first();
  if (!playlist) throw Object.assign(new Error("Playlist not found"), { statusCode: 404 });

  const { name, description, is_active, cover_image, category_id } = data;
  const update: any = { updated_at: new Date() };
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (is_active !== undefined) update.is_active = is_active ? 1 : 0;
  if (cover_image !== undefined) update.cover_image = cover_image || null;
  if (category_id !== undefined) update.category_id = category_id || null;

  await kdb("radio_playlists").where({ id: playlistId }).update(update);
}

export async function deletePlaylist(playlistId: string) {
  const playlist = await kdb("radio_playlists").where({ id: playlistId }).first();
  if (!playlist) throw Object.assign(new Error("Playlist not found"), { statusCode: 404 });
  await kdb("radio_playlists").where({ id: playlistId }).del();
}

export async function getPlaylistItems(playlistId: string) {
  const items = await kdb("radio_playlist_items").where({ playlist_id: playlistId }).orderBy("sort_order", "asc");
  return items.map((i: any) => ({
    id: i.id, playlist_id: i.playlist_id, item_type: i.item_type,
    item_id: i.item_id || "", item_title: i.item_title || "",
    item_thumbnail: i.item_thumbnail || "", sort_order: i.sort_order,
  }));
}

export async function addPlaylistItem(playlistId: string, data: any) {
  const playlist = await kdb("radio_playlists").where({ id: playlistId }).first();
  if (!playlist) throw Object.assign(new Error("Playlist not found"), { statusCode: 404 });

  const { item_type, item_id, item_title, item_thumbnail } = data;
  const [maxSort] = await kdb("radio_playlist_items").where({ playlist_id: playlistId }).max("sort_order as mx");
  const sortOrder = (maxSort?.mx ?? -1) + 1;

  const id = uuidv4();
  await kdb("radio_playlist_items").insert({
    id, playlist_id: playlistId, item_type, item_id,
    item_title: item_title || null, item_thumbnail: item_thumbnail || null,
    sort_order: sortOrder, created_at: new Date(),
  });
  return { id };
}

export async function bulkAddPlaylistItems(playlistId: string, items: any[], userId: string) {
  const playlist = await kdb("radio_playlists").where({ id: playlistId }).first();
  if (!playlist) throw Object.assign(new Error("Playlist not found"), { statusCode: 404 });

  const [maxSort] = await kdb("radio_playlist_items").where({ playlist_id: playlistId }).max("sort_order as mx");
  let sortOrder = (maxSort?.mx ?? -1) + 1;

  const videoRows: any[] = [];
  const itemRows: any[] = [];

  for (const item of items) {
    const existingVideo = await kdb("radio_videos").where({ youtube_id: item.youtube_id }).first();
    let videoId: string;

    if (existingVideo) {
      videoId = existingVideo.id;
      const existingTags = existingVideo.tags ? existingVideo.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
      if (!existingVideo.program) {
        const newTags = [...new Set([...existingTags, playlist.category_id].filter(Boolean))];
        await kdb("radio_videos").where({ id: existingVideo.id }).update({ program: playlistId, tags: newTags.join(",") || null });
      } else if (playlist.category_id && !existingTags.includes(playlist.category_id)) {
        await kdb("radio_videos").where({ id: existingVideo.id }).update({ tags: [...existingTags, playlist.category_id].join(",") });
      }
    } else {
      videoId = uuidv4();
      const autoTags = playlist.category_id ? [playlist.category_id] : [];
      videoRows.push({
        id: videoId, title: item.title || item.youtube_id, description: item.description || null,
        youtube_url: `https://www.youtube.com/watch?v=${item.youtube_id}`, youtube_id: item.youtube_id,
        thumbnail: item.thumbnail || null, program: playlistId, tags: autoTags.join(","),
        uploaded_by: userId, created_at: new Date(), updated_at: new Date(),
      });
    }

    itemRows.push({
      id: uuidv4(), playlist_id: playlistId, item_type: "youtube",
      item_id: videoId, item_title: item.title || null,
      item_thumbnail: item.thumbnail || null, sort_order: sortOrder++, created_at: new Date(),
    });
  }

  if (videoRows.length > 0) await kdb("radio_videos").insert(videoRows);
  await kdb("radio_playlist_items").insert(itemRows);
  return itemRows.length;
}

export async function updatePlaylistItem(playlistId: string, itemId: string, data: any) {
  const item = await kdb("radio_playlist_items").where({ id: itemId, playlist_id: playlistId }).first();
  if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });

  const { sort_order, item_title } = data;
  const update: any = {};
  if (sort_order !== undefined) update.sort_order = sort_order;
  if (item_title !== undefined) update.item_title = item_title;

  await kdb("radio_playlist_items").where({ id: itemId }).update(update);
}

export async function deletePlaylistItem(playlistId: string, itemId: string) {
  const item = await kdb("radio_playlist_items").where({ id: itemId, playlist_id: playlistId }).first();
  if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
  await kdb("radio_playlist_items").where({ id: itemId }).del();
}

export async function reorderPlaylistItems(playlistId: string, items: { id: string; sort_order: number }[]) {
  for (const item of items) {
    await kdb("radio_playlist_items").where({ id: item.id, playlist_id: playlistId }).update({ sort_order: item.sort_order });
  }
}
