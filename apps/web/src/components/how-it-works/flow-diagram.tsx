import {
	ArrowRightIcon,
	ListIcon,
	MailIcon,
	NewspaperIcon,
	SparkIcon,
} from "#/components/icons";
import { useI18n } from "#/libs/i18n/context";
import classes from "./how-it-works.module.css";

const NODE_ICONS = [ListIcon, NewspaperIcon, SparkIcon, MailIcon];

export function FlowDiagram() {
	const { t } = useI18n();
	const page = t.method.page;

	return (
		<figure className={classes.figure}>
			<ol className={classes.flow} aria-label={page.diagramLabel}>
				{page.flow.map((node, index) => {
					const Icon = NODE_ICONS[index];
					const isLast = index === page.flow.length - 1;

					return (
						<li key={node.title} className={classes.flowItem}>
							<div className={classes.node}>
								<span className={classes.nodeIcon}>
									<Icon size={20} />
								</span>

								<p className={classes.nodeTitle}>{node.title}</p>
								<p className={classes.nodeMeta}>{node.meta}</p>
							</div>
							{isLast ? null : <ArrowRightIcon className={classes.arrow} />}
						</li>
					);
				})}
			</ol>

			<figcaption className={classes.caption}>{page.caption}</figcaption>
		</figure>
	);
}
