import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import {
	useCreateUser,
	useDeleteUser,
	useUpdateUser,
} from "../hooks/mutation/users.mutation";
import { useUsers } from "../hooks/query/users.query";
import type { getUsers } from "../libs/api/users.api";

export const Route = createFileRoute("/users")({ component: UsersPage });

type User = Awaited<ReturnType<typeof getUsers>>["data"][number];
type UserForm = { email: string; username: string; name: string };

const defaultForm: UserForm = { email: "", username: "", name: "" };

function UsersPage() {
	const { data: response, isLoading } = useUsers();
	const users = response?.data ?? [];
	const createUser = useCreateUser();
	const updateUser = useUpdateUser();
	const deleteUser = useDeleteUser();

	const [modal, setModal] = useState<
		{ type: "create" } | { type: "edit"; user: User } | null
	>(null);
	const [form, setForm] = useState<UserForm>(defaultForm);

	function openCreate() {
		setForm(defaultForm);
		setModal({ type: "create" });
	}

	function openEdit(user: User) {
		setForm({
			email: user.email,
			username: user.username ?? "",
			name: user.name ?? "",
		});
		setModal({ type: "edit", user });
	}

	function handleClose() {
		setModal(null);
	}

	function handleSubmit() {
		if (modal?.type === "create") {
			createUser.mutate(
				{
					email: form.email,
					username: form.username || undefined,
					name: form.name || undefined,
				},
				{ onSuccess: handleClose },
			);
		} else if (modal?.type === "edit") {
			updateUser.mutate(
				{
					id: modal.user.id,
					username: form.username || undefined,
					name: form.name || undefined,
				},
				{ onSuccess: handleClose },
			);
		}
	}

	const columns: ColumnDef<User>[] = [
		{ accessorKey: "id", header: "ID" },
		{ accessorKey: "email", header: "Email" },
		{
			accessorKey: "username",
			header: "Username",
			cell: ({ getValue }) => (getValue() as string | null) ?? "—",
		},
		{
			accessorKey: "name",
			header: "Nom",
			cell: ({ getValue }) => (getValue() as string | null) ?? "—",
		},
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
						onClick={() => deleteUser.mutate(row.original.id)}
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
				<h1 className="text-xl font-semibold text-gray-900">Utilisateurs</h1>
				<button
					type="button"
					onClick={openCreate}
					className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
				>
					Nouvel utilisateur
				</button>
			</div>

			<DataTable data={users} columns={columns} />

			<Modal
				open={modal !== null}
				onClose={handleClose}
				title={
					modal?.type === "create"
						? "Nouvel utilisateur"
						: "Modifier l'utilisateur"
				}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
					{modal?.type === "create" && (
						<div>
							<label
								htmlFor="user-email"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Email
							</label>
							<input
								id="user-email"
								type="email"
								required
								value={form.email}
								onChange={(e) =>
									setForm((f) => ({ ...f, email: e.target.value }))
								}
								className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					)}
					<div>
						<label
							htmlFor="user-username"
							className="block text-sm font-medium text-gray-700 mb-1"
						>
							Username
						</label>
						<input
							id="user-username"
							type="text"
							value={form.username}
							onChange={(e) =>
								setForm((f) => ({ ...f, username: e.target.value }))
							}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label
							htmlFor="user-name"
							className="block text-sm font-medium text-gray-700 mb-1"
						>
							Nom
						</label>
						<input
							id="user-name"
							type="text"
							value={form.name}
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
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
							disabled={createUser.isPending || updateUser.isPending}
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
