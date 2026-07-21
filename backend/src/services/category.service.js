const pool = require("../config/db");
const env = require("../config/env");

async function getCategorySupport() {
    const q = await pool.query(
        `SELECT
       to_regclass($1) IS NOT NULL AS has_categories_table,
       to_regclass($2) IS NOT NULL AS has_device_category_map_table,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = $3
           AND table_name = 'devices'
           AND column_name = 'category_id'
       ) AS has_device_category_column`,
        [`${env.dbSchema}.device_categories`, `${env.dbSchema}.device_category_map`, env.dbSchema]
    );

    return {
        hasCategoriesTable: Boolean(q.rows[0]?.has_categories_table),
        hasDeviceCategoryMapTable: Boolean(q.rows[0]?.has_device_category_map_table),
        hasDeviceCategoryColumn: Boolean(q.rows[0]?.has_device_category_column),
    };
}

async function listCategories(userId) {
    const q = await pool.query(
        `SELECT id, user_id, name, created_at
     FROM device_categories
     WHERE user_id = $1
     ORDER BY created_at DESC`,
        [userId]
    );

    return q.rows;
}

async function ensureCategoryNameAvailable(userId, name, excludedCategoryId = null) {
    const values = [userId, name.trim()];
    let excludedCondition = "";

    if (excludedCategoryId !== null) {
        values.push(excludedCategoryId);
        excludedCondition = `AND id <> $${values.length}`;
    }

    const existing = await pool.query(
        `SELECT id
     FROM device_categories
     WHERE user_id = $1
       AND LOWER(BTRIM(name)) = LOWER($2)
       ${excludedCondition}
     LIMIT 1`,
        values
    );

    if (existing.rowCount > 0) {
        throw new Error("CATEGORY_ALREADY_EXISTS");
    }
}

async function createCategory(userId, payload) {
    await ensureCategoryNameAvailable(userId, payload.name);

    const q = await pool.query(
        `INSERT INTO device_categories (user_id, name)
     VALUES ($1, $2)
     RETURNING id, user_id, name, created_at`,
        [userId, payload.name.trim()]
    );

    return q.rows[0];
}

async function updateCategory(userId, categoryId, payload) {
    await ensureCategoryNameAvailable(userId, payload.name, categoryId);

    const q = await pool.query(
        `UPDATE device_categories
     SET name = $1
     WHERE id = $2 AND user_id = $3
     RETURNING id, user_id, name, created_at`,
        [payload.name.trim(), categoryId, userId]
    );

    if (q.rowCount === 0) {
        throw new Error("CATEGORY_NOT_FOUND");
    }

    return q.rows[0];
}

async function deleteCategory(userId, categoryId) {
    const support = await getCategorySupport();

    if (support.hasDeviceCategoryColumn) {
        await pool.query(
            `UPDATE devices
       SET category_id = NULL
       WHERE user_id = $1 AND category_id = $2`,
            [userId, categoryId]
        );
    }

    if (support.hasDeviceCategoryMapTable) {
        await pool.query(
            `DELETE FROM device_category_map m
       USING devices d
       WHERE m.device_id = d.id
         AND d.user_id = $1
         AND m.category_id = $2`,
            [userId, categoryId]
        );
    }

    const q = await pool.query(
        `DELETE FROM device_categories
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
        [categoryId, userId]
    );

    if (q.rowCount === 0) {
        throw new Error("CATEGORY_NOT_FOUND");
    }

    return { id: q.rows[0].id };
}

module.exports = {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
};
