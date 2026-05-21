import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { createCategoryApi, deleteCategoryApi, listCategoriesApi, updateCategoryApi } from "../../services/api";
import ConfirmDialog from "../../components/ConfirmDialog";
import messages from "../../constants/messages";
import styles from "./styles";

function CategoryRow({ item, onEdit, onDelete }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowName}>{item.name}</Text>
      <View style={styles.rowActions}>
        <Pressable style={styles.editButton} onPress={() => onEdit(item)}>
          <Text style={styles.editText}>{messages.categories.editButton}</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={() => onDelete(item)}>
          <Text style={styles.deleteText}>{messages.categories.deleteButton}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ManageCategoryScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState(null);

  const load = useCallback(async () => {
    setError("");
    const data = await listCategoriesApi(token);
    setItems(data.items || []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      async function run() {
        setLoading(true);
        try {
          await load();
        } catch (err) {
          if (mounted) setError(err.message || messages.categories.loadFailed);
        } finally {
          if (mounted) setLoading(false);
        }
      }
      run();
      return () => {
        mounted = false;
      };
    }, [load])
  );

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    setError("");
    try {
      await createCategoryApi(token, { name });
      setNewName("");
      await load();
    } catch (err) {
      setError(err.message || messages.categories.createFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditingName(item.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit() {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    setSubmitting(true);
    setError("");
    try {
      await updateCategoryApi(token, editingId, { name });
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message || messages.categories.updateFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(item) {
    setPendingDeleteCategory(item);
  }

  async function handleDelete(id) {
    setSubmitting(true);
    setError("");
    try {
      await deleteCategoryApi(token, id);
      if (editingId === id) {
        cancelEdit();
      }
      await load();
    } catch (err) {
      setError(err.message || messages.categories.deleteFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDeleteCategory() {
    const current = pendingDeleteCategory;
    setPendingDeleteCategory(null);
    if (!current) return;
    await handleDelete(current.id);
  }

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color="#0f62fe" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{messages.categories.pageTitle}</Text>
      <Text style={styles.subtitle}>{messages.categories.subtitle}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{messages.categories.addNewTitle}</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder={messages.categories.categoryNameExamplePlaceholder}
            placeholderTextColor="#8aa0b8"
          />
          <Pressable style={styles.addButton} onPress={handleAdd} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>{messages.categories.addButton}</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{messages.categories.categoryListTitle}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {editingId ? (
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>{messages.categories.editTitle}</Text>
            <TextInput
              style={styles.input}
              value={editingName}
              onChangeText={setEditingName}
              placeholder={messages.categories.categoryNamePlaceholder}
              placeholderTextColor="#8aa0b8"
            />
            <View style={styles.editActions}>
              <Pressable style={styles.saveButton} onPress={saveEdit} disabled={submitting}>
                <Text style={styles.saveText}>{messages.categories.saveButton}</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                <Text style={styles.cancelText}>{messages.categories.cancelButton}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <CategoryRow item={item} onEdit={startEdit} onDelete={confirmDelete} />}
          ListEmptyComponent={<Text style={styles.empty}>{messages.categories.empty}</Text>}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      </View>

      <ConfirmDialog
        visible={Boolean(pendingDeleteCategory)}
        title={messages.categories.deleteDialogTitle}
        message={`${pendingDeleteCategory?.name || ""}: ${messages.categories.deleteDialogMessage}`}
        confirmText={messages.categories.deleteButton}
        cancelText={messages.categories.cancelButton}
        onCancel={() => setPendingDeleteCategory(null)}
        onConfirm={handleConfirmDeleteCategory}
      />
    </View>
  );
}
