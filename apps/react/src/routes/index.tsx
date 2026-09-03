import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import {
	useCreatePost,
	useDeletePost,
	useUpdatePost,
} from "../hooks/mutation/posts.mutation";
import { usePosts } from "../hooks/query/posts.query";
import type { getPosts } from "../libs/api/posts.api";

export const Route = createFileRoute("/")({ component: PostsPage });

type Post = Awaited<ReturnType<typeof getPosts>>["data"][number];
type PostForm = { title: string; content: string; authorId: string };

const defaultForm: PostForm = { title: "", content: "", authorId: "" };

function PostsPage() {
	const { data: response, isLoading } = usePosts();
	const posts = response?.data ?? [];
	const createPost = useCreatePost();
	const updatePost = useUpdatePost();
	const deletePost = useDeletePost();

	const [modal, setModal] = useState<
		{ type: "create" } | { type: "edit"; post: Post } | null
	>(null);
	const [form, setForm] = useState<PostForm>(defaultForm);

	function openCreate() {
		setForm(defaultForm);
		setModal({ type: "create" });
	}

	function openEdit(post: Post) {
		setForm({
			title: post.title,
			content: post.content ?? "",
			authorId: String(post.authorId),
		});
		setModal({ type: "edit", post });
	}

	function handleClose() {
		setModal(null);
	}

	function handleSubmit() {
		if (modal?.type === "create") {
			createPost.mutate(
				{
					title: form.title,
					content: form.content || undefined,
					authorId: Number(form.authorId),
				},
				{ onSuccess: handleClose },
			);
		} else if (modal?.type === "edit") {
			updatePost.mutate(
				{
					id: modal.post.id,
					title: form.title,
					content: form.content || undefined,
				},
				{ onSuccess: handleClose },
			);
		}
	}

	const columns: ColumnDef<Post>[] = [
		{ accessorKey: "id", header: "ID" },
		{ accessorKey: "title", header: "Titre" },
		{
			accessorKey: "content",
			header: "Contenu",
			cell: ({ getValue }) => (getValue() as string | null) ?? "—",
		},
		{ accessorKey: "authorId", header: "Auteur ID" },
		{
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() => openEdit(row.original)}
						className="text-blue-600 hover:text-blue-800 text-sm"
					>
						Modifier
					</button>
					<button
						type="button"
						onClick={() => deletePost.mutate(row.original.id)}
						className="text-red-600 hover:text-red-800 text-sm"
					>
						Supprimer
					</button>
				</div>
			),
		},
	];

	if (isLoading)
		return <div className="py-8 text-center text-gray-500">Chargement…</div>;

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-xl font-semibold text-gray-900">Posts</h1>
				<button
					type="button"
					onClick={openCreate}
					className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
				>
					Nouveau post
				</button>
			</div>

			<DataTable data={posts} columns={columns} />

			<Modal
				open={modal !== null}
				onClose={handleClose}
				title={modal?.type === "create" ? "Nouveau post" : "Modifier le post"}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
					<div>
						<label
							htmlFor="post-title"
							className="block text-sm font-medium text-gray-700 mb-1"
						>
							Titre
						</label>
						<input
							id="post-title"
							type="text"
							required
							value={form.title}
							onChange={(e) =>
								setForm((f) => ({ ...f, title: e.target.value }))
							}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label
							htmlFor="post-content"
							className="block text-sm font-medium text-gray-700 mb-1"
						>
							Contenu
						</label>
						<textarea
							id="post-content"
							value={form.content}
							onChange={(e) =>
								setForm((f) => ({ ...f, content: e.target.value }))
							}
							rows={3}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					{modal?.type === "create" && (
						<div>
							<label
								htmlFor="post-author"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Auteur ID
							</label>
							<input
								id="post-author"
								type="number"
								required
								min="1"
								value={form.authorId}
								onChange={(e) =>
									setForm((f) => ({ ...f, authorId: e.target.value }))
								}
								className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					)}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={handleClose}
							className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
						>
							Annuler
						</button>
						<button
							type="submit"
							disabled={createPost.isPending || updatePost.isPending}
							className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
						>
							{modal?.type === "create" ? "Créer" : "Enregistrer"}
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
