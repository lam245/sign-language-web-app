import matplotlib.pyplot as plt
import numpy as np
import matplotlib.ticker as ticker

# Data for the top-K analysis
k_values = [1, 2, 3, 4, 5, 6]
f1_scores = [84.62, 85.37, 84.91, 84.23, 83.47, 82.15]

# Create the figure and axis
plt.figure(figsize=(10, 6))
ax = plt.gca()

# Plot the data with connected line and markers
plt.plot(k_values, f1_scores, 'o-', color='#1f77b4', linewidth=2, markersize=8, 
         markerfacecolor='#1f77b4', markeredgecolor='black', markeredgewidth=1)

# Add data labels above each point
for i, (k, f1) in enumerate(zip(k_values, f1_scores)):
    plt.text(k, f1 + 0.15, f"{f1:.2f}", ha='center', va='bottom', fontweight='bold')

# Highlight the peak value (K=2)
plt.scatter([2], [85.37], s=200, color='#ff7f0e', alpha=0.3, zorder=5)
plt.annotate('Peak', xy=(2, 85.37), xytext=(2.3, 85.8),
             fontsize=12, fontweight='bold', color='#ff7f0e',
             arrowprops=dict(facecolor='#ff7f0e', shrink=0.05, alpha=0.7))

# Set the title and labels
plt.title('Impact of Top-K Selection on MARS-Attribute F1 Score', fontsize=16, fontweight='bold', pad=15)
plt.xlabel('Top-K Value', fontsize=14, fontweight='bold', labelpad=10)
plt.ylabel('F1 Score (%)', fontsize=14, fontweight='bold', labelpad=10)

# Customize the axis
plt.xlim(0.5, 6.5)
plt.ylim(81.5, 86)
ax.xaxis.set_major_locator(ticker.MultipleLocator(1))
ax.yaxis.set_major_locator(ticker.MultipleLocator(0.5))
plt.grid(True, linestyle='--', alpha=0.7)

# Add a legend
plt.legend(['F1 Score (%)'], loc='lower left')

# Add a box around the figure
ax.spines['top'].set_visible(True)
ax.spines['right'].set_visible(True)
ax.spines['left'].set_linewidth(1.5)
ax.spines['bottom'].set_linewidth(1.5)
ax.spines['top'].set_linewidth(1.5)
ax.spines['right'].set_linewidth(1.5)

# Add a text annotation describing the key finding
plt.figtext(0.5, 0.01, 
            "Performance peaks at K=2 (85.37%) and gradually declines as K increases, "
            "suggesting optimal balance between specialization and knowledge sharing.", 
            ha='center', fontsize=10, wrap=True)

# Adjust layout and save
plt.tight_layout()
plt.savefig('topk_analysis.png', dpi=300, bbox_inches='tight')
plt.show()